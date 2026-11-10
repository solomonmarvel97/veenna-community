'use strict';

/**
 * Entry point for the main process's IPC handlers. Each file under `handlers/` owns one area
 * and registers its own channels (names live in `channels.cjs`).
 */

const localStore = require('../lib/localStore/localStore.cjs');
const { createTrayMenuDeps } = require('./trayMenu.cjs');
const hotkey = require('./handlers/hotkey.cjs');

const HANDLER_MODULES = [
  require('./handlers/window.cjs'),
  require('./handlers/text.cjs'),
  require('./handlers/overlay.cjs'),
  hotkey,
  require('./handlers/dictation.cjs'),
  require('./handlers/localStore.cjs'),
  require('./handlers/speech.cjs'),
  require('./handlers/community.cjs'),
];

/**
 * @param {{
 *   getTrustedWebContentsList: () => Array<import('electron').WebContents | null | undefined>,
 *   getDictationWebContents: () => import('electron').WebContents | null | undefined,
 * }} deps
 */
function registerIpcHandlers(deps) {
  const ctx = { ...deps, trust: () => deps.getTrustedWebContentsList() };
  for (const handlers of HANDLER_MODULES) handlers.register(ctx);
}

/** Release what the handlers hold open: the global hotkey and the local database. */
function cleanupIpcResources() {
  hotkey.unregisterVoiceHotkey();
  localStore.closeLocalStore();
}

module.exports = {
  registerIpcHandlers,
  cleanupIpcResources,
  unregisterVoiceHotkey: hotkey.unregisterVoiceHotkey,
  createTrayMenuDeps,
};
