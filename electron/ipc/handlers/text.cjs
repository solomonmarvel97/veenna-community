'use strict';

/** Text out: paste into the app being dictated into, copy to the clipboard, read the foreground app. */

const { ipcMain } = require('electron');
const channels = require('../channels.cjs');
const { trustedHandler } = require('../../lib/ipcSecurity.cjs');
const { pasteIntoForegroundApp, writeClipboardText, getForegroundContext } = require('../../lib/nativePlatform.cjs');

/**
 * @param {{ trust: () => unknown[], getDictationWebContents: () => any, getTrustedWebContentsList: () => any[] }} ctx - from registerHandlers.cjs
 */
function register({ trust }) {
  // The note arrives as one standalone page (styles, fonts and images inlined);
  // a hidden window lays it out and Chromium prints it as vector PDF.

  ipcMain.handle(
    channels.PASTE_TEXT,
    trustedHandler(trust, async (_event, text, target, allowFallbackTarget = true) =>
      pasteIntoForegroundApp(text, target, allowFallbackTarget !== false),
    ),
  );

  ipcMain.handle(
    channels.COPY_TEXT,
    trustedHandler(trust, (_event, text) => writeClipboardText(text)),
  );

  ipcMain.handle(
    channels.GET_FOREGROUND_APP,
    trustedHandler(trust, async () => {
      const foreground = await getForegroundContext();
      return foreground ?? { appName: null, windowTitle: null, bundleId: null, textInputFocused: false };
    }),
  );

}

module.exports = { register };
