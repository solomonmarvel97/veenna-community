'use strict';

/** Tray menu hooks: what the tray asks of the HUD and the overlay. */

const channels = require('./channels.cjs');
const { broadcast } = require('./broadcast.cjs');
const { setOverlayHudIdleVisible, isOverlayHudIdleVisible } = require('../lib/overlayWindow.cjs');
const { notifyTrayMenuChanged, getTrayDictationState } = require('../lib/tray.cjs');

/**
 * Tray menu + toolbar: start/stop hands-free dictation on the HUD (Option twice).
 * @param {() => import('electron').WebContents | null | undefined} getDictationWebContents
 */
function sendHudDictationRecordingAction(getDictationWebContents) {
  const wc = getDictationWebContents();
  if (!wc || wc.isDestroyed()) return { ok: false, reason: 'no_hud' };
  const { state } = getTrayDictationState();

  if (state === 'recording') {
    wc.send('dictation-hotkey', { action: 'confirm' });
    return { ok: true };
  }
  if (state === 'idle' || state === 'error') {
    wc.send('dictation-hotkey', { action: 'toggle-continuous' });
    return { ok: true };
  }
  return { ok: false, reason: 'busy' };
}

/**
 * @param {{
 *   getTrustedWebContentsList: () => Array<import('electron').WebContents | null | undefined>,
 *   getDictationWebContents: () => import('electron').WebContents | null | undefined,
 *   getMainWebContents?: () => import('electron').WebContents | null | undefined,
 * }} deps
 */
function createTrayMenuDeps(deps) {
  const { getDictationWebContents, getTrustedWebContentsList,  } = deps;

  function broadcastHudIdlePersist(visible) {
    broadcast(getTrustedWebContentsList(), channels.HUD_IDLE_VISIBLE_SYNC, {
      visible: Boolean(visible),
      persist: true,
    });
  }

  return {
    isHudIdleVisible: isOverlayHudIdleVisible,
    async onTrayDictationAction(kind) {
      if (kind !== 'recording') return;
      const wc = getDictationWebContents();
      if (!wc || wc.isDestroyed()) return;
      sendHudDictationRecordingAction(getDictationWebContents);
    },
    onTrayHudIdleVisible(visible) {
      setOverlayHudIdleVisible(visible);
      notifyTrayMenuChanged();
      broadcastHudIdlePersist(visible);
    }
  };
}

module.exports = { createTrayMenuDeps };
