'use strict';

/**
 * When the HUD is on screen. It shows while recording, while the dictation key is held, and,
 * if the owner turned the idle pill on, between sessions (hiding again after IDLE_HIDE_MS).
 */

const { state } = require('./state.cjs');
const {
  CAN_PARK_OVERLAY,
  liveWindow,
  applyWindowLevel,
  applyCapturePolicy,
  isShown,
  parkOverlay,
} = require('./chrome.cjs');
const { startOverlayPointerTracking, stopOverlayPointerTracking } = require('./pointer.cjs');

/** Hide the floating pill after this long with no dictation use. */
const IDLE_HIDE_MS = 2 * 60 * 1000;
/** Grace period after a short tap, so recording can start before the HUD hides. */
const WAKE_GRACE_MS = 220;
const RECORDING_WATCH_MS = 1000;

/** Should the HUD be on screen right now? */
function wantsToShow() {
  return state.busy || state.dictationWake || state.hudIdleVisible;
}

function clearIdleHideTimer() {
  if (state.idleHideTimer) clearTimeout(state.idleHideTimer);
  state.idleHideTimer = null;
}

function clearWakeHideTimer() {
  if (state.wakeHideTimer) clearTimeout(state.wakeHideTimer);
  state.wakeHideTimer = null;
}

function hideOverlay() {
  const win = liveWindow();
  if (!win) return;
  clearIdleHideTimer();
  clearWakeHideTimer();
  stopOverlayPointerTracking();
  // A press cannot survive the window going away; never leave the lock stuck on.
  state.pointerLocked = false;
  // A HUD that took focus (Cancel / OK clicked) must really go, or Cmd+V for the paste
  // would land in it instead of the owner's app.
  if (CAN_PARK_OVERLAY && !win.isFocused()) {
    parkOverlay(win);
    return;
  }
  try {
    win.setOpacity(1);
  } catch {
    /* unsupported platform */
  }
  if (win.isVisible()) win.hide();
}

function scheduleIdleHide() {
  clearIdleHideTimer();
  // A held hotkey is about to start recording: hiding now made the HUD blink off and back on.
  if (state.busy || state.dictationWake) return;
  if (!state.hudIdleVisible) {
    hideOverlay();
    return;
  }
  // Only auto-hide when the idle pill is already visible; never re-show after a session ends.
  const win = liveWindow();
  if (!win || !isShown(win)) return;
  state.idleHideTimer = setTimeout(() => {
    state.idleHideTimer = null;
    hideOverlay();
  }, IDLE_HIDE_MS);
}

/** Show the HUD without taking focus, if anything wants it shown; otherwise hide it. */
function showOverlayInactive() {
  const win = liveWindow();
  if (!win) return;
  if (!wantsToShow()) {
    hideOverlay();
    return;
  }
  // Already on screen: re-showing and re-applying level settings to a visible panel is what
  // flickered it, and state reports arrive many times a second.
  if (!isShown(win)) {
    // Parked windows are already ordered in: only the opacity changes.
    if (!win.isVisible()) {
      applyWindowLevel(win);
      // Never steal focus: paste must land in the user's current caret app or field.
      win.showInactive();
      applyCapturePolicy(win);
    }
    try {
      win.setOpacity(1);
    } catch {
      /* unsupported platform */
    }
  }
  startOverlayPointerTracking();
  if (!state.busy) scheduleIdleHide();
}

/** Renderer → main: show the overlay once the new chrome has painted. */
function revealOverlay() {
  if (liveWindow() && wantsToShow()) showOverlayInactive();
}

/** The owner turned the idle pill on or off. */
function setOverlayHudIdleVisible(visible) {
  state.hudIdleVisible = Boolean(visible);
  if (state.busy) return;
  if (state.hudIdleVisible) showOverlayInactive();
  else hideOverlay();
}

/** Whether the owner has the idle pill turned on. */
function isOverlayHudIdleVisible() {
  return state.hudIdleVisible;
}

/** Whether the HUD may appear in screen shares and recordings. */
function setOverlayHudVisibleDuringScreenShare(visible) {
  state.hudVisibleDuringScreenShare = Boolean(visible);
  const win = liveWindow();
  if (win) applyCapturePolicy(win);
}

/** Dictation key went down (or similar): flag only; setOverlayBusy shows the recording chrome. */
function noteOverlayActivity() {
  state.dictationWake = true;
  clearIdleHideTimer();
  clearWakeHideTimer();
}

/**
 * Hotkey fully released. A short tap releases the key before recording has had a chance to
 * flip `busy`, so give that a beat to land instead of blinking the HUD off and back on.
 */
function noteOverlayDictationKeyReleased() {
  state.dictationWake = false;
  if (state.busy) return;
  if (state.hudIdleVisible) {
    scheduleIdleHide();
    return;
  }
  clearWakeHideTimer();
  state.wakeHideTimer = setTimeout(() => {
    state.wakeHideTimer = null;
    if (!wantsToShow()) hideOverlay();
  }, WAKE_GRACE_MS);
}

/** While a recording runs, keep re-showing the HUD in case anything took it off screen. */
function syncRecordingWatch() {
  if (state.recording && !state.recordingWatch) {
    state.recordingWatch = setInterval(showOverlayInactive, RECORDING_WATCH_MS);
    state.recordingWatch.unref?.();
  } else if (!state.recording && state.recordingWatch) {
    clearInterval(state.recordingWatch);
    state.recordingWatch = null;
  }
}

/** The renderer's dictation state: busy while recording, processing or showing an error. */
function setOverlayBusy(busy, { recording = false } = {}) {
  state.recording = Boolean(recording);
  syncRecordingWatch();
  state.busy = Boolean(busy);
  clearWakeHideTimer();
  state.dictationWake = false;
  if (state.busy) {
    clearIdleHideTimer();
    showOverlayInactive();
    return;
  }
  if (!state.hudIdleVisible) {
    hideOverlay();
    return;
  }
  // Stay on screen: the renderer collapses the chrome in place and the pill is already
  // centred, so the dot stays where it was through the handoff.
  scheduleIdleHide();
}

module.exports = {
  IDLE_HIDE_MS,
  hideOverlay,
  showOverlayInactive,
  revealOverlay,
  setOverlayHudIdleVisible,
  isOverlayHudIdleVisible,
  setOverlayHudVisibleDuringScreenShare,
  noteOverlayActivity,
  noteOverlayDictationKeyReleased,
  setOverlayBusy,
  clearIdleHideTimer,
  clearWakeHideTimer,
  scheduleIdleHide,
};
