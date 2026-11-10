'use strict';

/** Dictation state: tray and HUD state, audio ducking, open-at-login, and the voice-data broadcast. */

const { ipcMain } = require('electron');
const channels = require('../channels.cjs');
const { broadcast } = require('../broadcast.cjs');
const { trustedHandler } = require('../../lib/ipcSecurity.cjs');
const { setOverlayInteractive, setOverlayBusy } = require('../../lib/overlayWindow.cjs');
const { getOpenAtLoginStatus, setOpenAtLogin } = require('../../lib/desktopPreferences.cjs');
const { setTrayDictationState } = require('../../lib/tray.cjs');
const { syncDictationAudioDuck } = require('../../lib/audioDuck.cjs');
const { isDuckAudioWhileDictatingEnabled, setDuckAudioWhileDictating } = require('../../lib/desktopSettings.cjs');

/**
 * What may cross from one window to another about saved data. Anything else a window sends is
 * dropped, so a window cannot push arbitrary fields into the others.
 */
function sanitizeVoiceDataPayload(payload) {
  if (!payload || typeof payload !== 'object') return {};
  return {
    audioSaving: Boolean(payload.audioSaving),
    ...(typeof payload.audioCaptureId === 'string' && payload.audioCaptureId
      ? { audioCaptureId: payload.audioCaptureId }
      : {}),
    ...(payload.capture && typeof payload.capture === 'object' ? { capture: payload.capture } : {}),
  };
}

/**
 * @param {{ trust: () => unknown[], getTrustedWebContentsList: () => any[] }} ctx - from registerHandlers.cjs
 */
function register({ trust, getTrustedWebContentsList }) {
  ipcMain.handle(
    channels.GET_OPEN_AT_LOGIN,
    trustedHandler(trust, () => getOpenAtLoginStatus()),
  );

  ipcMain.handle(
    channels.SET_OPEN_AT_LOGIN,
    trustedHandler(trust, (_event, enabled) => setOpenAtLogin(Boolean(enabled))),
  );

  // The HUD reports its state (idle, recording, processing, error) on every change.
  ipcMain.handle(
    channels.DICTATION_STATE,
    trustedHandler(trust, (_event, payload) => {
      const state = typeof payload === 'string' ? payload : payload?.state;
      setTrayDictationState(state);
      const busy = state === 'recording' || state === 'processing' || state === 'error';
      setOverlayBusy(busy, { recording: state === 'recording' });
      // Focusable while busy so Cancel / OK work; always mouse-aware for dragging.
      setOverlayInteractive(busy);
      const duckEnabled =
        typeof payload === 'object' && payload !== null && payload.duckAudio != null
          ? Boolean(payload.duckAudio)
          : isDuckAudioWhileDictatingEnabled();
      void syncDictationAudioDuck(state, { enabled: duckEnabled });
      return { ok: true };
    }),
  );

  ipcMain.handle(
    channels.SET_DUCK_AUDIO_WHILE_DICTATING,
    trustedHandler(trust, (_event, enabled) => {
      setDuckAudioWhileDictating(Boolean(enabled));
      if (!enabled) void syncDictationAudioDuck('idle', { enabled: false });
      return { ok: true, enabled: isDuckAudioWhileDictatingEnabled() };
    }),
  );

  // A window finished saving a dictation or its audio: tell the others.
  ipcMain.handle(
    channels.VOICE_DATA_CHANGED,
    trustedHandler(trust, (_event, payload) => {
      broadcast(getTrustedWebContentsList(), channels.VOICE_DATA_CHANGED, sanitizeVoiceDataPayload(payload));
      return { ok: true };
    }),
  );
}

module.exports = { register };
