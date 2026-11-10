'use strict';

/**
 * Hit testing for the HUD. The window spans far more than it draws, so everything outside the
 * drawn chrome is click-through; this tracks the cursor and flips that on and off.
 */

const { screen } = require('electron');
const { state } = require('./state.cjs');
const { liveWindow, applyWindowLevel, isShown } = require('./chrome.cjs');

/** Renderer event telling the HUD whether the cursor is over its chrome. */
const OVERLAY_POINTER_EVENT = 'veenna:overlay-pointer';
/** Flip a little before the cursor lands, so a fast click is never swallowed. */
const HIT_PADDING = 12;
const TRACKING_INTERVAL_MS = 32;

function sendOverlayPointer(inside) {
  const wc = liveWindow()?.webContents;
  if (!wc || wc.isDestroyed()) return;
  try {
    wc.send(OVERLAY_POINTER_EVENT, { inside: Boolean(inside) });
  } catch {
    /* tearing down */
  }
}

/** Remember whether the cursor is over the chrome and tell the renderer when that changes. */
function setPointerInside(inside) {
  if (inside === state.pointerInside) return;
  state.pointerInside = inside;
  sendOverlayPointer(inside);
}

function cursorOverChrome(cursor, bounds) {
  // No chrome report yet: stay click-through. Treating the whole canvas as live used to
  // freeze the app underneath until the HUD reported its rect.
  if (!state.hitRect) return false;
  const left = bounds.x + state.hitRect.x - HIT_PADDING;
  const top = bounds.y + state.hitRect.y - HIT_PADDING;
  const right = left + state.hitRect.width + HIT_PADDING * 2;
  const bottom = top + state.hitRect.height + HIT_PADDING * 2;
  return cursor.x >= left && cursor.x < right && cursor.y >= top && cursor.y < bottom;
}

function setPassthrough(win, passthrough) {
  if (state.passthrough === passthrough) return;
  try {
    win.setIgnoreMouseEvents(passthrough);
    state.passthrough = passthrough;
  } catch (err) {
    console.warn('[overlay] passthrough toggle failed', err);
  }
}

function tickPointerTracking() {
  const win = liveWindow();
  if (!win || !isShown(win)) {
    setPointerInside(false);
    return;
  }
  const inside = cursorOverChrome(screen.getCursorScreenPoint(), win.getBounds());
  setPassthrough(win, !inside && !state.pointerLocked);
  setPointerInside(inside);
}

function startOverlayPointerTracking() {
  if (state.pointerTimer) return;
  state.pointerTimer = setInterval(tickPointerTracking, TRACKING_INTERVAL_MS);
  tickPointerTracking();
}

function stopOverlayPointerTracking() {
  if (state.pointerTimer) {
    clearInterval(state.pointerTimer);
    state.pointerTimer = null;
  }
  setPointerInside(false);
}

/**
 * Renderer → main: the rect the HUD actually draws into, window-local CSS px. Everything
 * outside it is click-through, which keeps the fixed-size window from swallowing clicks.
 */
function setOverlayHitRect(rect) {
  const values = rect ? [rect.x, rect.y, rect.width, rect.height].map(Number) : [];
  const valid = values.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0;
  state.hitRect = valid ? { x: values[0], y: values[1], width: values[2], height: values[3] } : null;
  if (valid) tickPointerTracking();
}

/**
 * Reassert hit testing. Avoid showInactive while a click is in flight: it drops pointerup on macOS.
 * `lock` holds the window mouse-aware for the length of a press; without it a drag that outran
 * the hit rect would flip the window click-through mid-gesture and cut off the pointermove events.
 */
function engageOverlayPointer({ promote = false, lock } = {}) {
  if (typeof lock === 'boolean') state.pointerLocked = lock;
  const win = liveWindow();
  if (!win || !isShown(win)) return;
  try {
    win.setIgnoreMouseEvents(false);
    state.passthrough = false;
    win.setFocusable(true);
    if (promote) applyWindowLevel(win);
  } catch (err) {
    console.warn('[overlay] engage pointer failed', err);
  }
}

/**
 * Keep the HUD mouse-aware so it stays draggable. It stays focusable so the first click
 * reaches the renderer (macOS drops pointerup on focusable:false panels); showInactive plus
 * mousedown preventDefault in the HUD view keep keyboard focus in the user's app.
 */
function setOverlayInteractive(interactive) {
  const win = liveWindow();
  if (!win) return;
  try {
    // Only what changed: this runs on every state report, and re-setting these flickers.
    if (!state.focusable) {
      win.setFocusable(true);
      state.focusable = true;
    }
    if (interactive && state.passthrough !== false) {
      win.setIgnoreMouseEvents(false);
      state.passthrough = false;
    }
    if (isShown(win)) startOverlayPointerTracking();
  } catch (err) {
    console.warn('[overlay] setOverlayInteractive failed', err);
  }
}

module.exports = {
  startOverlayPointerTracking,
  stopOverlayPointerTracking,
  setOverlayHitRect,
  engageOverlayPointer,
  setOverlayInteractive,
};
