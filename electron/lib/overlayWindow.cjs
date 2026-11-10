'use strict';

/**
 * The dictation HUD's public surface. The implementation lives in `overlay/`:
 * geometry (pure layout), state (shared), chrome (native window behaviour), position (placing and
 * dragging), pointer (click-through hit testing), visibility (when it shows) and window (creation).
 */

const windowApi = require('./overlay/window.cjs');
const visibility = require('./overlay/visibility.cjs');
const pointer = require('./overlay/pointer.cjs');
const position = require('./overlay/position.cjs');

module.exports = {
  createOverlayWindow: windowApi.createOverlayWindow,
  getOverlayWebContents: windowApi.getOverlayWebContents,
  repositionOverlayForDisplay: windowApi.repositionOverlayForDisplay,
  destroyOverlayWindow: windowApi.destroyOverlayWindow,
  showOverlayInactive: visibility.showOverlayInactive,
  hideOverlay: visibility.hideOverlay,
  revealOverlay: visibility.revealOverlay,
  noteOverlayActivity: visibility.noteOverlayActivity,
  noteOverlayDictationKeyReleased: visibility.noteOverlayDictationKeyReleased,
  setOverlayBusy: visibility.setOverlayBusy,
  setOverlayHudIdleVisible: visibility.setOverlayHudIdleVisible,
  isOverlayHudIdleVisible: visibility.isOverlayHudIdleVisible,
  setOverlayHudVisibleDuringScreenShare: visibility.setOverlayHudVisibleDuringScreenShare,
  setOverlayHitRect: pointer.setOverlayHitRect,
  engageOverlayPointer: pointer.engageOverlayPointer,
  setOverlayInteractive: pointer.setOverlayInteractive,
  moveOverlayByDelta: position.moveOverlayByDelta,
};
