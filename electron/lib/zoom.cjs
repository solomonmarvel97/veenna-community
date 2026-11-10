'use strict';

const { BrowserWindow } = require('electron');
const { ZOOM_LIMITS } = require('../config/app.cjs');
const channels = require('../ipc/channels.cjs');

/** @type {WeakSet<import('electron').WebContents>} */
const fixedZoomContents = new WeakSet();

function clampFactor(factor) {
  const stepped = Math.round(factor * 100) / 100;
  return Math.min(ZOOM_LIMITS.max, Math.max(ZOOM_LIMITS.min, stepped));
}

/** Set the zoom and tell the page, which shows the new value in its corner. */
function setZoom(webContents, factor) {
  if (fixedZoomContents.has(webContents)) return;
  webContents.setZoomFactor(factor);
  webContents.send(channels.ZOOM_CHANGED, factor);
}

/** @param {import('electron').WebContents | undefined} webContents @param {number} delta */
function zoomBy(webContents, delta) {
  if (!webContents || webContents.isDestroyed()) return;
  setZoom(webContents, clampFactor(webContents.getZoomFactor() + delta));
}

/** @param {import('electron').WebContents | undefined} webContents */
function resetZoom(webContents) {
  if (!webContents || webContents.isDestroyed()) return;
  setZoom(webContents, 1);
}

/**
 * Ignore the zoom menu and shortcuts for a window that must keep its size, such
 * as the HUD when a click on it left it focused.
 * @param {import('electron').WebContents} webContents
 */
function keepZoomFixed(webContents) {
  fixedZoomContents.add(webContents);
}

function focusedWebContents() {
  return BrowserWindow.getFocusedWindow()?.webContents;
}

/**
 * Zoom between the min and max in config, for menu items, shortcuts and
 * ctrl-wheel alike.
 * @param {import('electron').WebContents} webContents
 */
function attachZoomLimits(webContents) {
  if (!webContents || webContents.isDestroyed()) return;
  // Pinch zoom is a separate, unbounded path; keep the page at its real size.
  if (typeof webContents.setVisualZoomLevelLimits === 'function') {
    webContents.setVisualZoomLevelLimits(1, 1);
  }
  webContents.on('zoom-changed', (_event, direction) => {
    zoomBy(webContents, direction === 'in' ? ZOOM_LIMITS.step : -ZOOM_LIMITS.step);
  });
}

module.exports = { attachZoomLimits, keepZoomFixed, zoomBy, resetZoom, focusedWebContents };
