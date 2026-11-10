'use strict';

const path = require('path');
const { app } = require('electron');
const { resolvePackagedPath } = require('./resolvePackagedPath.cjs');
const {
  forkOnnxInferenceProcess,
  sendOnnxMessage,
  terminateOnnxProcess,
  writeOnnxSamplesFile,
  unlinkQuiet,
} = require('./onnxInferenceProcess.cjs');
const whisperModels = require('./whisperModels.cjs');
const { catalogEntry } = require('./speechModelFiles.cjs');
const {
  preloadWhisperCpp,
  transcribeWithWhisperCpp,
  disposeWhisperCpp,
} = require('./whisperCppStt.cjs');

const CATALOG = require('../../src/lib/voice/whisper-model-catalog.json');
/** veenna-whisper and Whisper itself both take mono 16 kHz audio. */
const WHISPER_CPP_SAMPLE_RATE = 16000;

let worker = null;
let workerReady = null;
let nextId = 1;
/** @type {Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>} */
const pending = new Map();

function workerScriptPath() {
  return resolvePackagedPath(path.join(__dirname, 'localSttWorker.cjs'));
}

function cacheDir() {
  return path.join(app.getPath('userData'), 'cache', 'transformers');
}

function modelsRootForModel(modelId) {
  const installed = whisperModels.resolveInstalledModelRoot(modelId);
  if (!installed) return null;
  const depth = String(modelId).split('/').length;
  let root = installed.root;
  for (let i = 0; i < depth; i += 1) {
    root = path.dirname(root);
  }
  return root;
}

/** The ggml file of a whisper-cpp model, or null for any other runtime. */
function whisperCppModelPath(modelId) {
  const entry = catalogEntry(CATALOG, modelId);
  if (entry?.runtime !== 'whisper-cpp') return null;
  const installed = whisperModels.resolveInstalledModelRoot(modelId);
  if (!installed) throw new Error(modelUnavailableMessage());
  return path.join(installed.root, entry.file);
}

function modelUnavailableMessage() {
  return 'Local speech model is not installed. Open Settings → Speech models to check status.';
}

/** IPC may deliver ArrayBuffer or a TypedArray view depending on structured clone. */
function normalizeSamplesBuffer(value) {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  }
  return null;
}

function failPending(error) {
  for (const [, entry] of pending) entry.reject(error);
  pending.clear();
}

function ensureWorker() {
  if (worker) return workerReady;
  workerReady = new Promise((resolve, reject) => {
    worker = forkOnnxInferenceProcess(workerScriptPath());

    worker.on('message', (message) => {
      if (message?.type === 'ready') {
        resolve(true);
        return;
      }
      if (message?.type === 'result' || message?.type === 'error') {
        const entry = pending.get(message.id);
        if (!entry) return;
        pending.delete(message.id);
        if (message.type === 'error') {
          entry.reject(new Error(message.message || 'local_stt_failed'));
        } else {
          entry.resolve(message);
        }
      }
    });

    worker.on('error', (error) => {
      failPending(error);
      reject(error);
    });

    worker.on('exit', (code) => {
      worker = null;
      workerReady = null;
      if (code !== 0 && code !== null) {
        failPending(new Error(`local stt worker exited (${code})`));
      }
    });
  });
  return workerReady;
}

async function sendWorkerMessage(message) {
  await ensureWorker();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    void sendOnnxMessage(worker, { ...message, id }).catch((error) => {
      pending.delete(id);
      reject(error);
    });
  });
}

async function preloadModel(modelId) {
  const ggmlPath = whisperCppModelPath(modelId);
  if (ggmlPath) {
    await preloadWhisperCpp(ggmlPath);
    return;
  }
  const modelsRoot = modelsRootForModel(modelId);
  if (!modelsRoot) {
    throw new Error(modelUnavailableMessage());
  }
  await sendWorkerMessage({
    type: 'preload',
    modelId,
    modelsRoot,
    cacheDir: cacheDir(),
  });
}

async function transcribeAudio(payload) {
  const modelId = typeof payload?.modelId === 'string' ? payload.modelId.trim() : '';
  if (!whisperModels.isAllowedModelId(modelId)) {
    throw new Error('unknown_model');
  }

  const ggmlPath = whisperCppModelPath(modelId);
  const modelsRoot = ggmlPath ? null : modelsRootForModel(modelId);
  if (!ggmlPath && !modelsRoot) {
    throw new Error(modelUnavailableMessage());
  }

  const samplesBuffer = normalizeSamplesBuffer(payload?.samples);
  if (!samplesBuffer || samplesBuffer.byteLength === 0) {
    throw new Error('empty_audio');
  }

  const sampleRate = Number(payload?.sampleRate);
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error('invalid_sample_rate');
  }

  if (ggmlPath) {
    if (sampleRate !== WHISPER_CPP_SAMPLE_RATE) throw new Error('invalid_sample_rate');
    const startedAt = Date.now();
    const text = await transcribeWithWhisperCpp({
      modelPath: ggmlPath,
      samples: new Float32Array(samplesBuffer),
      language: typeof payload?.language === 'string' ? payload.language : null,
    });
    return {
      text,
      durationMs: payload?.durationMs ?? null,
      inferenceMs: Date.now() - startedAt,
      runtime: 'whisper-cpp',
    };
  }

  const samplesPath = writeOnnxSamplesFile(samplesBuffer);
  const startedAt = Date.now();
  try {
    const result = await sendWorkerMessage({
      type: 'transcribe',
      samplesPath,
      sampleRate,
      modelId,
      modelsRoot,
      cacheDir: cacheDir(),
      language: typeof payload?.language === 'string' ? payload.language : null,
      durationMs: payload?.durationMs ?? null,
    });
    return {
      text: String(result.text || '').trim(),
      durationMs: result.durationMs ?? payload?.durationMs ?? null,
      inferenceMs: Date.now() - startedAt,
      runtime: 'onnx',
    };
  } finally {
    unlinkQuiet(samplesPath);
  }
}

async function resetModel() {
  disposeWhisperCpp();
  if (!worker) return;
  await sendWorkerMessage({ type: 'reset' });
}

function disposeLocalStt() {
  disposeWhisperCpp();
  if (worker) {
    void terminateOnnxProcess(worker);
    worker = null;
    workerReady = null;
  }
  pending.clear();
}

module.exports = {
  preloadModel,
  transcribeAudio,
  resetModel,
  disposeLocalStt,
};
