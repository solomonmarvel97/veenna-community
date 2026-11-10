'use strict';

/** The floating dictation HUD: its size, position, pointer capture and visibility. */

const { ipcMain } = require('electron');
const channels = require('../channels.cjs');
const { trustedHandler } = require('../../lib/ipcSecurity.cjs');
const { setOverlayHitRect, moveOverlayByDelta, engageOverlayPointer, revealOverlay, setOverlayHudIdleVisible, setOverlayHudVisibleDuringScreenShare } = require('../../lib/overlayWindow.cjs');
const { notifyTrayMenuChanged } = require('../../lib/tray.cjs');

/**
 * @param {{ trust: () => unknown[], getDictationWebContents: () => any, getTrustedWebContentsList: () => any[] }} ctx - from registerHandlers.cjs
 */
function register({ trust }) {
  // The window is a fixed-size canvas, so a mode change moves nothing: just make sure it is shown.
  ipcMain.handle(
    channels.OVERLAY_SET_EXPANDED,
    trustedHandler(trust, () => {
      revealOverlay();
      return { ok: true };
    }),
  );

  ipcMain.handle(
    channels.OVERLAY_SET_HIT_RECT,
    trustedHandler(trust, (_event, payload) => {
      setOverlayHitRect(payload);
      return { ok: true };
    }),
  );

  ipcMain.handle(
    channels.OVERLAY_MOVE_BY,
    trustedHandler(trust, (_event, payload) => {
      const deltaX =
        typeof payload === 'object' && payload !== null ? Number(payload.deltaX) : 0;
      const deltaY =
        typeof payload === 'object' && payload !== null ? Number(payload.deltaY) : 0;
      moveOverlayByDelta(deltaX, deltaY);
      return { ok: true };
    }),
  );

  ipcMain.handle(
    channels.OVERLAY_ENGAGE,
    trustedHandler(trust, (_event, payload) => {
      const lock =
        typeof payload === 'object' && payload !== null && typeof payload.lock === 'boolean'
          ? payload.lock
          : undefined;
      engageOverlayPointer({ lock });
      return { ok: true };
    }),
  );

  ipcMain.handle(
    channels.OVERLAY_REVEAL,
    trustedHandler(trust, () => {
      revealOverlay();
      return { ok: true };
    }),
  );

  ipcMain.handle(
    channels.OVERLAY_SET_HUD_IDLE_VISIBLE,
    trustedHandler(trust, (_event, payload) => {
      const visible =
        typeof payload === 'object' && payload !== null ? Boolean(payload.visible) : true;
      setOverlayHudIdleVisible(visible);
      notifyTrayMenuChanged();
      return { ok: true };
    }),
  );

  ipcMain.handle(
    channels.OVERLAY_SET_HUD_SCREEN_SHARE_VISIBLE,
    trustedHandler(trust, (_event, payload) => {
      const visible =
        typeof payload === 'object' && payload !== null ? Boolean(payload.visible) : false;
      setOverlayHudVisibleDuringScreenShare(visible);
      return { ok: true };
    }),
  );

}

module.exports = { register };
