'use strict';

/**
 * The HUD's shared mutable state. The overlay is split into small modules (position, pointer,
 * visibility, window); they all read and write this one object, so there is a single place to
 * see everything that can change.
 */

const { loadOverlayState } = require('../overlayState.cjs');
const { OVERLAY_WINDOW_SIZE } = require('./geometry.cjs');

const state = {
  /** @type {import('electron').BrowserWindow | null} */
  window: null,
  /** The saved dock position (edge and offset), see overlayState.cjs. */
  saved: loadOverlayState(),

  // Timers.
  movePersistTimer: null,
  idleHideTimer: null,
  wakeHideTimer: null,
  pointerTimer: null,
  /** While recording, re-shows the HUD if anything took it off screen. */
  recordingWatch: null,

  // Position.
  /** Non-zero while the main process is moving the window itself (drag follow, re-anchor). */
  programmaticBoundsChanges: 0,
  /** Pill position inside the window, CSS px. Mirrored to the renderer. */
  pillPoint: {
    x: Math.round(OVERLAY_WINDOW_SIZE.width / 2),
    y: Math.round(OVERLAY_WINDOW_SIZE.height / 2),
  },

  // Pointer.
  /**
   * Rect of the drawn chrome inside the window, CSS px, as reported by the renderer. Null until
   * the first report; until then the window is click-through so HUD boot cannot swallow clicks.
   */
  hitRect: null,
  /** Last value pushed to setIgnoreMouseEvents, to avoid redundant native calls. */
  passthrough: null,
  /** Whether setFocusable(true) has been pushed to this window yet. */
  focusable: false,
  /** Held for the length of a press so a drag cannot lose the mouse mid-gesture. */
  pointerLocked: false,
  /** Whether the system cursor is over the drawn chrome (main-process tracking). */
  pointerInside: false,

  // Visibility.
  /** True while recording / processing / error: never auto-hide. */
  busy: false,
  /** When false, hide the HUD between dictation sessions (show only while busy). */
  hudIdleVisible: false,
  /** When false, exclude the HUD from screen shares and recordings (the default). */
  hudVisibleDuringScreenShare: false,
  /** True from hotkey down until recording starts or the key is released. */
  dictationWake: false,
  /** The HUD window owns a recording right now, so it must be on screen. */
  recording: false,
};

module.exports = { state };
