'use strict';

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const FILE_NAME = 'desktop-settings.json';
/** Mute-music is opt-in; bump when resetting the default for everyone. */
const DUCK_AUDIO_POLICY = 'opt-in-v1';

/** @type {{ duckAudioWhileDictating?: boolean, duckAudioPolicy?: string } | null} */
let cache = null;

function settingsPath() {
  return path.join(app.getPath('userData'), FILE_NAME);
}

function readSettings() {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf8');
    cache = JSON.parse(raw);
  } catch {
    cache = {};
  }
  return cache;
}

function writeSettings(patch) {
  const next = { ...readSettings(), ...patch };
  cache = next;
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(next), 'utf8');
  return next;
}

/** First launch / pre-policy installs stay off until the user enables mute music. */
function ensureDuckAudioOptInDefault() {
  const settings = readSettings();
  if (settings?.duckAudioPolicy === DUCK_AUDIO_POLICY) return settings;
  return writeSettings({
    duckAudioWhileDictating: false,
    duckAudioPolicy: DUCK_AUDIO_POLICY,
  });
}

function isDuckAudioWhileDictatingEnabled() {
  return Boolean(ensureDuckAudioOptInDefault()?.duckAudioWhileDictating);
}

module.exports = {
  isDuckAudioWhileDictatingEnabled,
  setDuckAudioWhileDictating: (enabled) =>
    writeSettings({
      duckAudioWhileDictating: Boolean(enabled),
      duckAudioPolicy: DUCK_AUDIO_POLICY,
    }),
};
