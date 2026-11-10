'use strict';

/** Native window behaviour the HUD needs: stacking level, capture exclusion, and "parked" mode. */

const { state } = require('./state.cjs');
const { applyOverlayCaptureExclusion } = require('../overlayCaptureExclude.cjs');

/** Where setOpacity works, "hidden" parks the window at opacity 0 (see parkOverlay). */
const CAN_PARK_OVERLAY = process.platform === 'darwin' || process.platform === 'win32';

/** Highest standard always-on-top band: stays above native fullscreen apps with visibleOnFullScreen. */
const ALWAYS_ON_TOP_LEVEL = 'screen-saver';

/** The live window, or null once it is gone. Use this instead of checking `state.window` by hand. */
function liveWindow() {
  const win = state.window;
  return win && !win.isDestroyed() ? win : null;
}

/**
 * Keep the HUD above normal, floating and native fullscreen windows (macOS spaces).
 * Re-run on every show and display change: macOS can drop the level after space transitions.
 */
function applyWindowLevel(win) {
  if (!win || win.isDestroyed()) return;
  try {
    if (process.platform === 'darwin') {
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
    } else if (process.platform === 'linux') {
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    win.setAlwaysOnTop(true, ALWAYS_ON_TOP_LEVEL, 1);
  } catch (err) {
    console.warn('[overlay] apply window level failed', err?.message || err);
  }
}

/** Apply the "hide from screen shares and recordings" setting to a window. */
function applyCapturePolicy(win) {
  applyOverlayCaptureExclusion(win, !state.hudVisibleDuringScreenShare);
}

/** On screen at full opacity (a window parked at opacity 0 does not count). */
function isShown(win) {
  if (!win.isVisible()) return false;
  try {
    return win.getOpacity() >= 1;
  } catch {
    return true;
  }
}

/**
 * "Hidden" between sessions means on screen at opacity 0, not `hide()`.
 *
 * A hidden window stops presenting frames, so showing it again first flashes the last frame
 * from the previous session, then a blank one while the compositor catches up, and only then
 * the recording chrome: the HUD blinked off and on. Parked, the renderer keeps painting, so
 * showing is just opacity 1 over a frame that is already current. Click-through while parked;
 * capture exclusion still applies.
 */
function parkOverlay(win) {
  win.setIgnoreMouseEvents(true);
  state.passthrough = true;
  win.setOpacity(0);
  if (!win.isVisible()) {
    applyWindowLevel(win);
    win.showInactive();
    applyCapturePolicy(win);
  }
}

module.exports = { CAN_PARK_OVERLAY, liveWindow, applyWindowLevel, applyCapturePolicy, isShown, parkOverlay };
