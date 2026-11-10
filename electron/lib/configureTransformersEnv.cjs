'use strict';

const fs = require('fs');
const path = require('path');

function getBundledModelsPath() {
  try {
    const { app } = require('electron');
    if (!app?.isPackaged) return null;
    const bundled = path.join(process.resourcesPath, 'models');
    return fs.existsSync(bundled) ? bundled : null;
  } catch {
    return null;
  }
}

/**
 * @xenova/transformers picks onnxruntime-node when `process.release.name === 'node'`.
 * That native dylib SIGTRAPs inside Electron (Chromium allocator vs ORT BFCArena).
 * Call this in the inference child process *before* importing transformers so it
 * uses onnxruntime-web (WASM) instead.
 */
function preferOnnxWasmBackend() {
  const current = process.release && typeof process.release === 'object' ? process.release : { name: 'node' };
  Object.defineProperty(process, 'release', {
    configurable: true,
    value: { ...current, name: 'browser' },
  });
}

function withWasmPrefix(dir) {
  const resolved = path.resolve(dir);
  return resolved.endsWith(path.sep) ? resolved : `${resolved}${path.sep}`;
}

function wasmDirIfPresent(pkgName) {
  try {
    const root = path.dirname(require.resolve(`${pkgName}/package.json`));
    const dist = path.join(root, 'dist');
    if (
      fs.existsSync(path.join(dist, 'ort-wasm-simd.wasm')) ||
      fs.existsSync(path.join(dist, 'ort-wasm.wasm'))
    ) {
      return withWasmPrefix(dist);
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * onnxruntime-web's Emscripten loader uses Node `fs.open` in ELECTRON_RUN_AS_NODE.
 * A `file:` URL (`file:/.../ort-wasm-simd.wasm`) ENOENTs even when the file exists.
 */
function resolveTransformersWasmDir() {
  return wasmDirIfPresent('@xenova/transformers') || wasmDirIfPresent('onnxruntime-web');
}

function applyOnnxWasmEnv(env) {
  const wasm = env?.backends?.onnx?.wasm;
  if (!wasm) return;
  wasm.numThreads = 1;
  wasm.proxy = false;
  const wasmDir = resolveTransformersWasmDir();
  if (wasmDir) wasm.wasmPaths = wasmDir;
}

/** Shared @xenova/transformers env for main process and worker. */
function configureTransformersEnv(env, cacheDir) {
  const cache = String(cacheDir || '').trim();
  if (cache) env.cacheDir = cache;
  env.allowLocalModels = true;
  env.useBrowserCache = false;
  applyOnnxWasmEnv(env);

  const bundled = getBundledModelsPath();
  if (bundled) {
    env.localModelPath = bundled;
    env.allowRemoteModels = false;
  }
}

/**
 * STT worker env: load the selected model strictly from disk.
 * `modelsRoot` is the directory that contains the model id path
 * (e.g. root + 'Xenova/whisper-small'), resolved by localStt.cjs.
 */
function configureMainProcessSttEnv(env, { modelsRoot, cacheDir } = {}) {
  configureTransformersEnv(env, cacheDir);
  const root = String(modelsRoot || '').trim();
  if (root && fs.existsSync(root)) {
    env.localModelPath = root;
  }
  env.allowRemoteModels = false;
}

module.exports = {
  preferOnnxWasmBackend,
  applyOnnxWasmEnv,
  configureTransformersEnv,
  configureMainProcessSttEnv,
  getBundledModelsPath,
  resolveTransformersWasmDir,
};
