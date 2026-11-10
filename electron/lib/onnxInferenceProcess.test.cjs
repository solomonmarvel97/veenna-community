'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { preferOnnxWasmBackend, applyOnnxWasmEnv, configureMainProcessSttEnv } = require('./configureTransformersEnv.cjs');
const { buildOnnxInferenceEnv } = require('./onnxInferenceProcess.cjs');
const { readOnnxWorkerData } = require('./onnxWorkerIpc.cjs');

test('preferOnnxWasmBackend makes transformers.js select the web/WASM runtime', () => {
  const previous = process.release;
  try {
    preferOnnxWasmBackend();
    assert.equal(process.release.name, 'browser');
  } finally {
    Object.defineProperty(process, 'release', {
      configurable: true,
      value: previous,
    });
  }
});

test('applyOnnxWasmEnv caps threads and points at a real wasm directory', () => {
  const env = { backends: { onnx: { wasm: { numThreads: 8, proxy: true } } } };
  applyOnnxWasmEnv(env);
  assert.equal(env.backends.onnx.wasm.numThreads, 1);
  assert.equal(env.backends.onnx.wasm.proxy, false);
  const wasmPaths = String(env.backends.onnx.wasm.wasmPaths || '');
  assert.equal(wasmPaths.startsWith('file:'), false);
  assert.match(wasmPaths, /[/\\]dist[/\\]$/);
  assert.equal(fs.existsSync(path.join(wasmPaths, 'ort-wasm-simd.wasm')), true);
});

test('configureMainProcessSttEnv pins models to a local root', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'veenna-stt-'));
  const env = { backends: { onnx: { wasm: {} } } };
  try {
    configureMainProcessSttEnv(env, { modelsRoot: dir, cacheDir: path.join(dir, 'cache') });
    assert.equal(env.localModelPath, dir);
    assert.equal(env.allowRemoteModels, false);
    assert.equal(env.cacheDir, path.join(dir, 'cache'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('onnx inference child env runs as Node and carries workerData', () => {
  const env = buildOnnxInferenceEnv({ cacheDir: '/tmp/cache' });
  assert.equal(env.ELECTRON_RUN_AS_NODE, '1');
  assert.equal(JSON.parse(env.VEENNA_ONNX_WORKER_DATA).cacheDir, '/tmp/cache');
});

test('sendOnnxMessage waits when the channel is full instead of throwing', async () => {
  let callback;
  const child = {
    killed: false,
    exitCode: null,
    send(_message, cb) {
      callback = cb;
      return false;
    },
    once() {},
  };
  const pending = require('./onnxInferenceProcess.cjs').sendOnnxMessage(child, { type: 'ping' });
  callback(null);
  await pending;
});

test('writeOnnxSamplesFile round-trips float32 pcm and rejects paths outside temp', () => {
  const { writeOnnxSamplesFile, readOnnxSamplesFile, unlinkQuiet } = require('./onnxInferenceProcess.cjs');
  const src = new Float32Array([0.1, -0.25, 0.5]).buffer;
  const filePath = writeOnnxSamplesFile(src);
  try {
    const roundTrip = new Float32Array(readOnnxSamplesFile(filePath));
    assert.equal(roundTrip.length, 3);
    assert.ok(Math.abs(roundTrip[1] + 0.25) < 1e-6);
    assert.throws(() => readOnnxSamplesFile('/tmp/not-veenna.f32'), /invalid_samples_path/);
  } finally {
    unlinkQuiet(filePath);
  }
});

test('readOnnxWorkerData parses VEENNA_ONNX_WORKER_DATA', () => {
  const previous = process.env.VEENNA_ONNX_WORKER_DATA;
  process.env.VEENNA_ONNX_WORKER_DATA = JSON.stringify({ cacheDir: '/tmp/models' });
  try {
    assert.deepEqual(readOnnxWorkerData(), { cacheDir: '/tmp/models' });
  } finally {
    if (previous === undefined) delete process.env.VEENNA_ONNX_WORKER_DATA;
    else process.env.VEENNA_ONNX_WORKER_DATA = previous;
  }
});
