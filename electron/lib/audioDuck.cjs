'use strict';

const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

/** @type {number | null} */
let savedOutputVolume = null;
/** @type {boolean} */
let duckingActive = false;

async function readMacOutputVolume() {
  const { stdout } = await execFileAsync('osascript', [
    '-e',
    'output volume of (get volume settings)',
  ]);
  const parsed = Number.parseInt(String(stdout).trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function writeMacOutputVolume(level) {
  const clamped = Math.max(0, Math.min(100, Math.round(level)));
  await execFileAsync('osascript', ['-e', `set volume output volume ${clamped}`]);
}

/**
 * Lower system output volume while dictating.
 * macOS only - other platforms no-op until native support is added.
 */
async function duckSystemAudio() {
  if (process.platform !== 'darwin' || duckingActive) return;
  try {
    const current = await readMacOutputVolume();
    if (current == null) return;
    savedOutputVolume = current;
    duckingActive = true;
    const ducked = Math.max(0, Math.round(current * 0.12));
    await writeMacOutputVolume(ducked);
  } catch {
    savedOutputVolume = null;
    duckingActive = false;
  }
}

async function restoreSystemAudio() {
  if (process.platform !== 'darwin' || !duckingActive) return;
  duckingActive = false;
  const previous = savedOutputVolume;
  savedOutputVolume = null;
  if (previous == null) return;
  try {
    await writeMacOutputVolume(previous);
  } catch {
    /* ignore restore failures */
  }
}

/**
 * @param {'idle' | 'recording' | 'processing' | 'error'} state
 * @param {{ enabled?: boolean }} [options]
 */
async function syncDictationAudioDuck(state, options = {}) {
  if (!options.enabled) {
    await restoreSystemAudio();
    return;
  }
  if (state === 'recording') {
    await duckSystemAudio();
    return;
  }
  if (state === 'idle' || state === 'error') {
    await restoreSystemAudio();
  }
}

module.exports = {
  duckSystemAudio,
  restoreSystemAudio,
  syncDictationAudioDuck,
};
