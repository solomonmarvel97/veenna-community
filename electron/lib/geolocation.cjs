'use strict';

const { session, systemPreferences } = require('electron');

function getMicrophoneAccessStatus() {
  if (process.platform !== 'darwin') return 'granted';
  try {
    return systemPreferences.getMediaAccessStatus('microphone');
  } catch {
    return 'granted';
  }
}

async function ensureMicrophoneAccess() {
  if (process.platform !== 'darwin') return true;

  try {
    let status = systemPreferences.getMediaAccessStatus('microphone');
    if (status === 'not-determined') {
      await systemPreferences.askForMediaAccess('microphone');
      status = systemPreferences.getMediaAccessStatus('microphone');
    }
    if (status === 'denied' || status === 'restricted') {
      console.warn(
        '[media] macOS microphone access denied. Enable veenna (or Electron in dev) under System Settings → Privacy & Security → Microphone.',
      );
      return false;
    }
    return status === 'granted';
  } catch {
    return true;
  }
}

function mediaRequestWantsAudio(details) {
  const mediaTypes = details?.mediaTypes;
  if (!Array.isArray(mediaTypes) || mediaTypes.length === 0) return true;
  return mediaTypes.includes('audio');
}

function setupSessionPermissions() {
  const ses = session.defaultSession;

  ses.setPermissionRequestHandler(async (_webContents, permission, callback, details) => {
    if (permission === 'media') {
      if (!mediaRequestWantsAudio(details)) {
        callback(false);
        return;
      }
      try {
        callback(await ensureMicrophoneAccess());
      } catch (err) {
        console.warn('[media] microphone permission request failed:', err?.message || err);
        callback(false);
      }
      return;
    }

    // The app's own pages ask for position (home weather, onboarding). macOS and
    // Windows still gate it behind their own Location Services switch; this only
    // stops Chromium from refusing before the OS is ever asked.
    if (permission === 'geolocation') {
      callback(true);
      return;
    }

    // The note's Font menu lists the fonts installed on this machine.
    if (permission === 'local-fonts') {
      callback(true);
      return;
    }

    callback(false);
  });

  ses.setPermissionCheckHandler((_webContents, permission, _origin, details) => {
    if (permission === 'geolocation') return true;
    if (permission === 'local-fonts') return true;
    if (permission === 'media') {
      if (!mediaRequestWantsAudio(details)) return false;
      const status = getMicrophoneAccessStatus();
      return status === 'granted' || status === 'not-determined';
    }
    return false;
  });
}

module.exports = {
  setupSessionPermissions,
  ensureMicrophoneAccess,
  mediaRequestWantsAudio,
  getMicrophoneAccessStatus,
};
