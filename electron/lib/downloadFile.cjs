'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const { URL } = require('url');

const DEFAULT_HEADERS = {
  'User-Agent': 'veenna-desktop',
  Accept: '*/*',
  'Accept-Encoding': 'identity',
  Connection: 'close',
};

const JSON_VALIDATE_MAX_BYTES = 8 * 1024 * 1024;

function createThrottledEmitter(onEvent, intervalMs) {
  let lastEmit = 0;
  let pending = null;
  let timer = null;

  function emit(payload, force = false) {
    pending = payload;
    const now = Date.now();
    if (force || now - lastEmit >= intervalMs) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      lastEmit = now;
      pending = null;
      onEvent?.(payload);
      return;
    }
    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        if (pending) {
          lastEmit = Date.now();
          const next = pending;
          pending = null;
          onEvent?.(next);
        }
      }, intervalMs - (now - lastEmit));
    }
  }

  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending) {
      const next = pending;
      pending = null;
      lastEmit = Date.now();
      onEvent?.(next);
    }
  }

  return { emit, flush };
}

function requestOnce(urlString, { headers, signal }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const succeed = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const parsed = new URL(urlString);
    const lib = parsed.protocol === 'http:' ? http : https;
    const req = lib.request(parsed, { method: 'GET', headers }, (res) => {
      succeed({ req, res });
    });
    req.on('error', fail);
    const onAbort = () => {
      req.destroy();
      fail(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    };
    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
      req.on('close', () => signal.removeEventListener('abort', onAbort));
    }
    req.end();
  });
}

async function getWithRedirects(urlString, { headers = DEFAULT_HEADERS, signal, maxRedirects = 8 } = {}) {
  let current = urlString;
  for (let i = 0; i <= maxRedirects; i += 1) {
    const { res } = await requestOnce(current, { headers, signal });
    const status = res.statusCode || 0;
    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume();
      current = new URL(res.headers.location, current).href;
      continue;
    }
    if (status < 200 || status >= 300) {
      res.resume();
      throw new Error(`download failed ${current} (${status})`);
    }
    return { res, finalUrl: current };
  }
  throw new Error(`too many redirects for ${urlString}`);
}

function createByteCounter(onBytes, intervalMs) {
  let received = 0;
  const throttled = createThrottledEmitter(onBytes, intervalMs);
  const stream = new Transform({
    highWaterMark: 64 * 1024,
    transform(chunk, _enc, cb) {
      received += chunk.length;
      throttled.emit(received);
      cb(null, chunk);
    },
    flush(cb) {
      throttled.flush();
      throttled.emit(received, true);
      cb();
    },
  });
  return { stream, getReceived: () => received };
}

async function downloadFileToPath(url, dest, { signal, onProgress, progressIntervalMs = 250 } = {}) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.download`;
  const { res } = await getWithRedirects(url, { headers: DEFAULT_HEADERS, signal });
  const total = Number(res.headers['content-length']) || 0;
  const { stream: counter, getReceived } = createByteCounter((received) => {
    onProgress?.({ received, total: total || received });
  }, progressIntervalMs);

  const file = fs.createWriteStream(tmp, { highWaterMark: 1024 * 1024 });
  try {
    await pipeline(res, counter, file, { signal });
    const received = getReceived();
    const written = fs.statSync(tmp).size;
    if (written !== received || (total > 0 && written !== total)) {
      throw new Error(
        `download incomplete for ${path.basename(dest)} (${written}/${total || received} bytes)`,
      );
    }
    if (dest.endsWith('.json') && written > 0 && written <= JSON_VALIDATE_MAX_BYTES) {
      try {
        JSON.parse(fs.readFileSync(tmp, 'utf8'));
      } catch {
        throw new Error(`downloaded ${path.basename(dest)} is not valid JSON - please retry`);
      }
    }
    fs.renameSync(tmp, dest);
  } catch (err) {
    file.destroy();
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}

module.exports = {
  DEFAULT_HEADERS,
  createThrottledEmitter,
  downloadFileToPath,
  getWithRedirects,
};
