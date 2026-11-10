'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { createThrottledEmitter, downloadFileToPath } = require('./downloadFile.cjs');

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function closeServer(server) {
  return new Promise((resolve) => {
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    server.close(() => resolve());
  });
}

test('throttled emitter coalesces bursts and flushes the last payload', () => {
  const seen = [];
  const { emit, flush } = createThrottledEmitter((payload) => seen.push(payload), 50);
  emit(1);
  emit(2);
  emit(3);
  assert.deepEqual(seen, [1]);
  flush();
  assert.deepEqual(seen, [1, 3]);
});

test('downloadFileToPath rejects HTTP errors', async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('missing');
  });
  const port = await listen(server);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'veenna-dl-'));
  const dest = path.join(dir, 'file.bin');
  try {
    await assert.rejects(
      () => downloadFileToPath(`http://127.0.0.1:${port}/missing.bin`, dest),
      /download failed.*404/,
    );
    assert.equal(fs.existsSync(dest), false);
    assert.equal(fs.existsSync(`${dest}.download`), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    await closeServer(server);
  }
});

test('downloadFileToPath aborts and deletes the temp file', async () => {
  const server = http.createServer((req, res) => {
    let stopped = false;
    const timer = setInterval(() => {
      if (stopped) {
        clearInterval(timer);
        return;
      }
      res.write(Buffer.alloc(32 * 1024, 1));
    }, 15);
    req.on('close', () => {
      stopped = true;
      clearInterval(timer);
    });
    res.writeHead(200, { 'Content-Length': String(32 * 1024 * 1024) });
  });
  const port = await listen(server);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'veenna-dl-'));
  const dest = path.join(dir, 'file.bin');
  const abort = new AbortController();
  const download = downloadFileToPath(`http://127.0.0.1:${port}/file.bin`, dest, {
    signal: abort.signal,
  });
  setTimeout(() => abort.abort(), 40);
  try {
    await assert.rejects(
      download,
      (err) => err instanceof Error && (err.name === 'AbortError' || /abort/i.test(err.message)),
    );
    assert.equal(fs.existsSync(dest), false);
    assert.equal(fs.existsSync(`${dest}.download`), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    await closeServer(server);
  }
});

test('downloadFileToPath streams to disk without buffering the body', async () => {
  const payload = Buffer.alloc(2 * 1024 * 1024, 7);
  const server = http.createServer((req, res) => {
    if (req.url === '/gone') {
      res.writeHead(302, { Location: '/file.bin' });
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Length': String(payload.length) });
    const chunk = 16 * 1024;
    let offset = 0;
    const write = () => {
      while (offset < payload.length) {
        const next = payload.subarray(offset, offset + chunk);
        offset += next.length;
        if (!res.write(next)) {
          res.once('drain', write);
          return;
        }
      }
      res.end();
    };
    write();
  });
  const port = await listen(server);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'veenna-dl-'));
  const dest = path.join(dir, 'file.bin');
  const progress = [];
  try {
    await downloadFileToPath(`http://127.0.0.1:${port}/gone`, dest, {
      progressIntervalMs: 50,
      onProgress: (event) => progress.push(event),
    });
    const written = fs.readFileSync(dest);
    assert.equal(written.length, payload.length);
    assert.equal(written.equals(payload), true);
    assert.ok(progress.length >= 1);
    assert.ok(progress.length < 40, `expected throttled progress, got ${progress.length}`);
    assert.equal(progress.at(-1)?.received, payload.length);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    await closeServer(server);
  }
});
