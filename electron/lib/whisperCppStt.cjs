'use strict';

/**
 * On-device dictation through veenna-whisper (whisper.cpp, GPU via Metal on
 * macOS). One helper process per model stays running with the model loaded;
 * requests go over its stdin as a header line plus raw float32 samples, and
 * each reply is one line. See electron/native/veenna-whisper/main.cpp.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const READY_TIMEOUT_MS = 60_000;
const REQUEST_TIMEOUT_MS = 120_000;

/** @type {{ child: import('child_process').ChildProcess, modelPath: string, ready: Promise<void> } | null} */
let helper = null;
let nextId = 1;
/** @type {Map<string, { resolve: (text: string) => void, reject: (error: Error) => void, timer: NodeJS.Timeout }>} */
const pending = new Map();

/**
 * The helper shipped inside the app (resources/whisper), or the copy
 * `bun run prepare:whisper` builds for development. Null when there is none.
 */
function findWhisperCppBinary({
  platform = process.platform,
  arch = process.arch,
  resourcesPath = process.resourcesPath,
  devBundleRoot = path.join(__dirname, '../../build/whisper-bundle'),
} = {}) {
  const osName = { darwin: 'mac', win32: 'win' }[platform] || platform;
  const exe = platform === 'win32' ? 'veenna-whisper.exe' : 'veenna-whisper';
  const candidates = [
    resourcesPath ? path.join(resourcesPath, 'whisper', 'bin', exe) : null,
    path.join(devBundleRoot, `${osName}-${arch}`, 'bin', exe),
  ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}

function failPending(error) {
  for (const [, entry] of pending) {
    clearTimeout(entry.timer);
    entry.reject(error);
  }
  pending.clear();
}

function onReplyLine(line) {
  const firstSpace = line.indexOf(' ');
  const secondSpace = firstSpace < 0 ? -1 : line.indexOf(' ', firstSpace + 1);
  if (firstSpace < 0) return;
  const id = line.slice(0, firstSpace);
  const status = line.slice(firstSpace + 1, secondSpace < 0 ? undefined : secondSpace);
  const body = secondSpace < 0 ? '' : line.slice(secondSpace + 1);
  const entry = pending.get(id);
  if (!entry) return;
  pending.delete(id);
  clearTimeout(entry.timer);
  if (status === 'ok') entry.resolve(body.trim());
  else entry.reject(new Error(body || 'local_stt_failed'));
}

function startHelper(binary, modelPath) {
  const child = spawn(binary, ['--model', modelPath], { stdio: ['pipe', 'pipe', 'pipe'] });
  let stderrTail = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderrTail = `${stderrTail}${chunk}`.slice(-2000);
  });

  const ready = new Promise((resolve, reject) => {
    let buffered = '';
    let isReady = false;
    const timer = setTimeout(() => {
      reject(new Error('veenna-whisper did not start in time'));
      child.kill();
    }, READY_TIMEOUT_MS);

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      buffered += chunk;
      let newline = buffered.indexOf('\n');
      while (newline >= 0) {
        const line = buffered.slice(0, newline).trimEnd();
        buffered = buffered.slice(newline + 1);
        if (!isReady && line === 'ready') {
          isReady = true;
          clearTimeout(timer);
          resolve();
        } else if (isReady) {
          onReplyLine(line);
        }
        newline = buffered.indexOf('\n');
      }
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      const error = new Error(
        `veenna-whisper exited (${signal || code})${stderrTail ? `: ${stderrTail.trim()}` : ''}`,
      );
      reject(error);
      failPending(error);
      if (helper?.child === child) helper = null;
    });
  });
  // A writer that loses the helper mid-request learns of it through 'exit'.
  child.stdin.on('error', () => {});
  ready.catch(() => {});
  return { child, modelPath, ready };
}

async function ensureHelper(modelPath) {
  if (helper && helper.modelPath !== modelPath) disposeWhisperCpp();
  if (!helper) {
    const binary = findWhisperCppBinary();
    if (!binary) throw new Error('veenna-whisper is not installed');
    helper = startHelper(binary, modelPath);
  }
  const current = helper;
  try {
    await current.ready;
  } catch (error) {
    if (helper === current) helper = null;
    throw error;
  }
  return current.child;
}

async function preloadWhisperCpp(modelPath) {
  await ensureHelper(modelPath);
}

/** @param {{ modelPath: string, samples: Float32Array, language?: string | null }} request */
async function transcribeWithWhisperCpp({ modelPath, samples, language }) {
  const child = await ensureHelper(modelPath);
  const id = String(nextId++);
  // One word on the header line; the helper detects the language for anything it does not know.
  const lang = String(language || 'en').trim().split(' ')[0] || 'en';
  const pcm = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('local transcription timed out'));
    }, REQUEST_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(`${id} ${samples.length} ${lang}\n`);
    child.stdin.write(pcm);
  });
}

function disposeWhisperCpp() {
  if (!helper) return;
  const { child } = helper;
  helper = null;
  failPending(new Error('veenna-whisper stopped'));
  child.stdin.end();
  child.kill();
}

module.exports = {
  findWhisperCppBinary,
  preloadWhisperCpp,
  transcribeWithWhisperCpp,
  disposeWhisperCpp,
};
