'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { fork } = require('child_process');
const { randomBytes } = require('crypto');

/**
 * Native onnxruntime-node in an Electron renderer/main process SIGTRAPs:
 * Chromium's allocator aborts inside ORT's BFCArena (Softmax Alloc).
 * Run inference in a child that behaves as Node (`ELECTRON_RUN_AS_NODE`)
 * so a model crash cannot take down the desktop app.
 */
function buildOnnxInferenceEnv(workerData) {
  return {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    VEENNA_ONNX_WORKER_DATA: workerData ? JSON.stringify(workerData) : '',
  };
}

function samplesTempDir() {
  return path.join(os.tmpdir(), 'veenna-onnx');
}

function writeOnnxSamplesFile(samplesBuffer) {
  const dir = samplesTempDir();
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${process.pid}-${randomBytes(8).toString('hex')}.f32`);
  fs.writeFileSync(filePath, Buffer.from(samplesBuffer));
  return filePath;
}

function readOnnxSamplesFile(filePath) {
  const resolved = path.resolve(String(filePath || ''));
  const root = path.resolve(samplesTempDir()) + path.sep;
  if (!resolved.startsWith(root) || !resolved.endsWith('.f32')) {
    throw new Error('invalid_samples_path');
  }
  const buf = fs.readFileSync(resolved);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function unlinkQuiet(filePath) {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* already gone */
  }
}

function forkOnnxInferenceProcess(scriptPath, { workerData } = {}) {
  // Ignore stdio so ORT/WASM logs cannot fill a pipe and stall the child
  // (a stalled child stops reading IPC, which previously surfaced as "ipc backlog").
  return fork(scriptPath, [], {
    execPath: process.execPath,
    env: buildOnnxInferenceEnv(workerData),
    serialization: 'json',
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    windowsHide: true,
    silent: true,
  });
}

function sendOnnxMessage(child, message) {
  return new Promise((resolve, reject) => {
    if (!child || child.killed || child.exitCode != null || typeof child.send !== 'function') {
      reject(new Error('onnx worker is not running'));
      return;
    }
    const sent = child.send(message, (err) => {
      if (err) reject(err);
      else resolve();
    });
    if (sent === false) {
      child.once('drain', () => {});
    }
  });
}

function terminateOnnxProcess(child) {
  if (!child || child.killed || child.exitCode != null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* already gone */
      }
      resolve();
    }, 2000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    try {
      child.kill('SIGTERM');
    } catch {
      clearTimeout(timer);
      resolve();
    }
  });
}

module.exports = {
  buildOnnxInferenceEnv,
  forkOnnxInferenceProcess,
  sendOnnxMessage,
  terminateOnnxProcess,
  writeOnnxSamplesFile,
  readOnnxSamplesFile,
  unlinkQuiet,
};
