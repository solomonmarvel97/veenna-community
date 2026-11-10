'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

/** @type {Map<string, Promise<string | null>>} */
const inFlight = new Map();

function existingHelper(bin) {
  return bin && fs.existsSync(bin) ? bin : null;
}

function helperNeedsRebuild(bin, src, isPackaged) {
  if (isPackaged) return false;
  if (!src || !fs.existsSync(src)) return false;
  if (!fs.existsSync(bin)) return true;
  return fs.statSync(src).mtimeMs > fs.statSync(bin).mtimeMs;
}

/**
 * Return a ready binary without blocking on `swiftc`.
 * A stale or missing helper compiles in the background so Electron menus stay live.
 *
 * @param {string} bin
 * @param {string} src
 * @param {string[]} compileArgs full `swiftc` argv including `-o` and source
 * @param {{ isPackaged?: boolean, onRebuilt?: (bin: string) => void }} [options]
 * @returns {string | null}
 */
function ensureSwiftHelper(bin, src, compileArgs, options = {}) {
  const isPackaged = Boolean(options.isPackaged);
  const current = existingHelper(bin);
  if (!helperNeedsRebuild(bin, src, isPackaged)) return current;

  if (!inFlight.has(bin)) {
    const args = Array.isArray(compileArgs) ? compileArgs : [];
    const job = execFileAsync('swiftc', args, { windowsHide: true })
      .then(() => existingHelper(bin))
      .catch((err) => {
        console.warn('[swift-helper] compile failed', src, err?.message || err);
        return current;
      })
      .finally(() => {
        inFlight.delete(bin);
      });
    inFlight.set(bin, job);
    void job.then((built) => {
      if (!built || typeof options.onRebuilt !== 'function') return;
      try {
        options.onRebuilt(built);
      } catch (err) {
        console.warn('[swift-helper] onRebuilt failed', err?.message || err);
      }
    });
  }
  return current;
}

module.exports = {
  ensureSwiftHelper,
  helperNeedsRebuild,
  existingHelper,
};
