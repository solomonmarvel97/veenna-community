'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { ensureSwiftHelper } = require('./swiftHelper.cjs');

function resolvePackagedPath(filePath) {
  if (filePath.includes(`${path.sep}app.asar${path.sep}`)) {
    return filePath.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
  }
  return filePath;
}

function helperBinaryPath() {
  if (app?.isPackaged) {
    const besideExec = path.join(path.dirname(process.execPath), 'veenna-overlay-capture-exclude');
    if (fs.existsSync(besideExec)) return besideExec;
  }
  return resolvePackagedPath(path.join(__dirname, '../macos-overlay-capture-exclude'));
}

function helperSourcePath() {
  return path.join(__dirname, '../macos-overlay-capture-exclude.swift');
}

function ensureHelperBuilt() {
  const bin = helperBinaryPath();
  const src = helperSourcePath();
  return ensureSwiftHelper(bin, src, ['-O', '-o', bin, src], {
    isPackaged: Boolean(app?.isPackaged),
  });
}

function readMacWindowId(browserWindow) {
  if (!browserWindow || browserWindow.isDestroyed()) return null;
  try {
    const mediaId = browserWindow.webContents?.getMediaSourceId?.();
    const match = typeof mediaId === 'string' ? mediaId.match(/window:(\d+):/) : null;
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/** @type {Map<string, { width: number, height: number, exclude: boolean }>} */
const pendingByWindowId = new Map();
/** @type {ReturnType<typeof setTimeout> | null} */
let flushTimer = null;

function flushCaptureExclusion() {
  flushTimer = null;
  if (!pendingByWindowId.size) return;

  let bin;
  try {
    bin = ensureHelperBuilt();
  } catch (err) {
    console.warn('[overlay] capture-exclude build failed', err?.message || err);
    pendingByWindowId.clear();
    return;
  }
  if (!bin) {
    pendingByWindowId.clear();
    return;
  }

  for (const [windowId, spec] of pendingByWindowId) {
    execFile(
      bin,
      [windowId, String(spec.width), String(spec.height), spec.exclude ? '1' : '0'],
      { timeout: 2500, windowsHide: true },
      (err) => {
        if (err) console.warn('[overlay] capture-exclude apply failed', err?.message || err);
      },
    );
  }
  pendingByWindowId.clear();
}

/**
 * Best-effort: hide the HUD from screen share / ScreenCaptureKit (macOS 15+).
 * Falls back silently when the helper is unavailable.
 * @param {import('electron').BrowserWindow} browserWindow
 * @param {boolean} exclude
 */
function setMacOverlayCaptureExclusion(browserWindow, exclude = true) {
  if (process.platform !== 'darwin') return;
  const windowId = readMacWindowId(browserWindow);
  if (!windowId) return;

  const bounds = browserWindow.getBounds();
  pendingByWindowId.set(windowId, {
    width: bounds.width,
    height: bounds.height,
    exclude: Boolean(exclude),
  });
  if (flushTimer) return;
  flushTimer = setTimeout(flushCaptureExclusion, 40);
}

/**
 * Best-effort: hide the HUD from screen share / ScreenCaptureKit (macOS 15+).
 * Falls back silently when the helper is unavailable.
 * @param {import('electron').BrowserWindow} browserWindow
 * @param {boolean} exclude When true, exclude the HUD from capture; when false, allow capture.
 */
function applyOverlayCaptureExclusion(browserWindow, exclude = true) {
  if (!browserWindow || browserWindow.isDestroyed()) return;
  try {
    browserWindow.setContentProtection(Boolean(exclude));
  } catch {
    /* ignore */
  }
  if (process.platform === 'darwin') {
    setMacOverlayCaptureExclusion(browserWindow, Boolean(exclude));
  }
}

module.exports = {
  applyOverlayCaptureExclusion,
  setMacOverlayCaptureExclusion,
};
