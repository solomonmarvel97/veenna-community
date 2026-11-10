'use strict';

/** Creating, repositioning and destroying the HUD's BrowserWindow. */

const path = require('path');
const { BrowserWindow } = require('electron');
const { SCHEME } = require('../protocol.cjs');
const { attachNavigationSecurity } = require('../security.cjs');
const { attachWindowListener, notifyWebContentsReady } = require('../../dictationHotkeyListener.cjs');
const { loadOverlayState } = require('../overlayState.cjs');
const { keepZoomFixed } = require('../zoom.cjs');
const { state } = require('./state.cjs');
const { OVERLAY_WINDOW_SIZE } = require('./geometry.cjs');
const { liveWindow, applyWindowLevel, applyCapturePolicy } = require('./chrome.cjs');
const { stopOverlayPointerTracking } = require('./pointer.cjs');
const { sendOverlayLayout, applyOverlayBounds, schedulePersistOverlayPosition } = require('./position.cjs');
const {
  hideOverlay,
  showOverlayInactive,
  scheduleIdleHide,
  clearIdleHideTimer,
  clearWakeHideTimer,
} = require('./visibility.cjs');

function getOverlayWindow() {
  return state.window;
}

function getOverlayWebContents() {
  return liveWindow()?.webContents ?? null;
}

/** The HUD page: the Vite dev server in development, the app's own scheme when packaged. */
function overlayUrl(loadViteDevServer, viteDevServerUrl) {
  return loadViteDevServer ? `${viteDevServerUrl}/dictation-hud` : `${SCHEME}://app/dictation-hud`;
}

function windowOptions() {
  return {
    width: OVERLAY_WINDOW_SIZE.width,
    height: OVERLAY_WINDOW_SIZE.height,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: true,
    show: false,
    backgroundColor: '#00000000',
    title: 'veenna Dictation',
    ...(process.platform === 'darwin'
      ? { type: 'panel', acceptFirstMouse: true, hiddenInMissionControl: true }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, '../../preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      autoplayPolicy: 'no-user-gesture-required',
      // The HUD is hidden between sessions, and Chromium throttles timers, rAF and
      // ResizeObserver in hidden windows. That delay lands on the hotkey path, so keep this
      // renderer running at full rate.
      backgroundThrottling: false,
      additionalArguments: ['--dictation-hud'],
    },
  };
}

function createOverlayWindow({ loadViteDevServer, viteDevServerUrl }) {
  if (liveWindow()) return state.window;

  state.saved = loadOverlayState();
  const win = new BrowserWindow(windowOptions());
  state.window = win;

  keepZoomFixed(win.webContents);
  applyWindowLevel(win);
  applyCapturePolicy(win);
  try {
    win.setIgnoreMouseEvents(true);
    state.passthrough = true;
  } catch {
    /* ignore */
  }

  win.on('show', () => applyWindowLevel(win));
  applyOverlayBounds(win, state.saved);

  win.on('moved', () => {
    applyCapturePolicy(win);
    // Expand, collapse and re-anchor already know the position; only a real drag may rewrite
    // the saved anchor, otherwise clamped bounds would creep inward.
    if (state.programmaticBoundsChanges > 0) return;
    schedulePersistOverlayPosition(win);
    // Dragging counts as use: reset the idle hide clock.
    if (!state.busy) scheduleIdleHide();
  });

  win.on('closed', () => {
    clearIdleHideTimer();
    state.window = null;
    state.focusable = false;
  });

  attachNavigationSecurity(win, { loadViteDevServer, viteDevServerUrl });
  attachWindowListener(() => (liveWindow() ? win.webContents : null))(win);

  void win.loadURL(overlayUrl(loadViteDevServer, viteDevServerUrl));
  win.webContents.once('did-finish-load', () => {
    applyCapturePolicy(win);
    // The renderer needs the pill point before it can paint anything in place.
    sendOverlayLayout();
    if (state.hudIdleVisible || state.busy) showOverlayInactive();
    else hideOverlay();
    notifyWebContentsReady(win.webContents);
  });

  return win;
}

/** Displays changed: re-resolve the anchor against the new work area. */
function repositionOverlayForDisplay() {
  const win = liveWindow();
  if (!win) return;
  applyWindowLevel(win);
  applyOverlayBounds(win, state.saved);
}

function destroyOverlayWindow() {
  clearIdleHideTimer();
  clearWakeHideTimer();
  stopOverlayPointerTracking();
  if (state.movePersistTimer) {
    clearTimeout(state.movePersistTimer);
    state.movePersistTimer = null;
  }
  liveWindow()?.destroy();
  state.window = null;
}

module.exports = { createOverlayWindow, getOverlayWindow, getOverlayWebContents, repositionOverlayForDisplay, destroyOverlayWindow };
