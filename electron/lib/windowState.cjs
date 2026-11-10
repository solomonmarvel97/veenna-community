'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { WINDOW_DEFAULTS } = require('../config/app.cjs');

const DEFAULT_BOUNDS = {
  width: WINDOW_DEFAULTS.width,
  height: WINDOW_DEFAULTS.height,
};

function stateFilePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState() {
  try {
    const raw = fs.readFileSync(stateFilePath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.width === 'number' && typeof parsed.height === 'number') {
      // Only a floor now - the window maximises and goes full screen, so an
      // upper clamp would shrink it back on the next launch.
      return {
        ...parsed,
        width: Math.max(parsed.width, WINDOW_DEFAULTS.minWidth),
        height: Math.max(parsed.height, WINDOW_DEFAULTS.minHeight),
      };
    }
  } catch {
    /* first launch */
  }
  return { ...DEFAULT_BOUNDS, isMaximized: false };
}

function saveWindowState(window) {
  if (!window || window.isDestroyed()) return;
  try {
    const bounds = window.getBounds();
    fs.writeFileSync(
      stateFilePath(),
      JSON.stringify({ ...bounds, isMaximized: false }, null, 2),
      'utf8',
    );
  } catch (err) {
    console.warn('[window-state] save failed:', err?.message || err);
  }
}

function attachWindowStatePersistence(window) {
  const persist = () => saveWindowState(window);
  window.on('resize', persist);
  window.on('move', persist);
  window.on('close', persist);
}

module.exports = {
  DEFAULT_BOUNDS,
  loadWindowState,
  saveWindowState,
  attachWindowStatePersistence,
};
