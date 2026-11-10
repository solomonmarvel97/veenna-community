'use strict';

function readOnnxWorkerData() {
  const raw = process.env.VEENNA_ONNX_WORKER_DATA;
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      /* fall through */
    }
  }
  try {
    return require('worker_threads').workerData || {};
  } catch {
    return {};
  }
}

function getOnnxWorkerIpc() {
  try {
    const { parentPort } = require('worker_threads');
    if (parentPort) {
      return {
        post(message) {
          parentPort.postMessage(message);
        },
        onMessage(listener) {
          parentPort.on('message', listener);
        },
      };
    }
  } catch {
    /* not a worker thread */
  }
  return {
    post(message) {
      if (typeof process.send === 'function') process.send(message);
    },
    onMessage(listener) {
      process.on('message', listener);
    },
  };
}

module.exports = { readOnnxWorkerData, getOnnxWorkerIpc };
