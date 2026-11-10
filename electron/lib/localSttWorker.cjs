'use strict';

const { preferOnnxWasmBackend, configureMainProcessSttEnv } = require('./configureTransformersEnv.cjs');
const { getOnnxWorkerIpc } = require('./onnxWorkerIpc.cjs');
const { readOnnxSamplesFile } = require('./onnxInferenceProcess.cjs');

preferOnnxWasmBackend();

const ipc = getOnnxWorkerIpc();
const CATALOG = require('../../src/lib/voice/whisper-model-catalog.json');

/** @type {ReturnType<typeof import('@xenova/transformers').pipeline> | null} */
let transcriberPromise = null;
let loadedModelId = null;

function isWhisperFamilyModel(modelId) {
  const entry = CATALOG.find((item) => item.id === modelId);
  return entry?.family === 'whisper';
}

async function getTranscriber(modelId, modelsRoot, cacheDir) {
  if (transcriberPromise && loadedModelId !== modelId) {
    transcriberPromise = null;
    loadedModelId = null;
  }

  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      const { pipeline, env } = await import('@xenova/transformers');
      configureMainProcessSttEnv(env, { modelsRoot, cacheDir });
      return pipeline('automatic-speech-recognition', modelId, {
        quantized: true,
        local_files_only: true,
      });
    })();
    loadedModelId = modelId;
    // The app warms the model at start; a failed load must not stick for every later dictation.
    const loading = transcriberPromise;
    loading.catch(() => {
      if (transcriberPromise === loading) resetTranscriber();
    });
  }

  return transcriberPromise;
}

function resetTranscriber() {
  transcriberPromise = null;
  loadedModelId = null;
}

async function transcribeSamples(transcriber, samples, modelId, language) {
  const pipelineOptions = {
    return_timestamps: false,
    chunk_length_s: 30,
    stride_length_s: 5,
  };
  if (isWhisperFamilyModel(modelId)) {
    pipelineOptions.language = String(language || 'english').trim().slice(0, 16) || 'english';
    pipelineOptions.task = 'transcribe';
  }
  const output = await transcriber(samples, pipelineOptions);
  return String(output?.text || '').trim();
}

ipc.onMessage(async (message) => {
  if (!message || typeof message !== 'object') return;

  if (message.type === 'preload') {
    try {
      await getTranscriber(message.modelId, message.modelsRoot, message.cacheDir);
      ipc.post({ type: 'result', id: message.id, ok: true });
    } catch (error) {
      ipc.post({
        type: 'error',
        id: message.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  if (message.type === 'reset') {
    resetTranscriber();
    ipc.post({ type: 'result', id: message.id, ok: true });
    return;
  }

  if (message.type === 'transcribe') {
    try {
      const samplesBuffer = message.samplesPath
        ? readOnnxSamplesFile(message.samplesPath)
        : null;
      if (!samplesBuffer || samplesBuffer.byteLength === 0) {
        throw new Error('empty_audio');
      }
      const sampleRate = Number(message.sampleRate);
      if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
        throw new Error('invalid_sample_rate');
      }

      const samples = new Float32Array(samplesBuffer);
      const transcriber = await getTranscriber(message.modelId, message.modelsRoot, message.cacheDir);
      const text = await transcribeSamples(transcriber, samples, message.modelId, message.language);
      ipc.post({
        type: 'result',
        id: message.id,
        text,
        durationMs: message.durationMs ?? null,
      });
    } catch (error) {
      ipc.post({
        type: 'error',
        id: message.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
});

ipc.post({ type: 'ready' });
