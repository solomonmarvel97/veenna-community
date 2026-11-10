'use strict';

/** Window and app: native theme, sidebar width, app info, opening web links. */

const { BrowserWindow, ipcMain, shell, nativeTheme, app } = require('electron');
const channels = require('../channels.cjs');
const { fitWindowToNav } = require('../../lib/navWindowWidth.cjs');
const { trustedHandler } = require('../../lib/ipcSecurity.cjs');

function validateThemeSource(source) {
  return source === 'light' || source === 'dark' ? source : 'system';
}

/**
 * @param {{ trust: () => unknown[], getDictationWebContents: () => any, getTrustedWebContentsList: () => any[] }} ctx - from registerHandlers.cjs
 */
function register({ trust }) {
  // Window chrome (the macOS traffic lights) follows nativeTheme, so it has to
  // track the app's own theme rather than the OS appearance.
  ipcMain.handle(
    channels.SET_NATIVE_THEME,
    trustedHandler(trust, (_event, source) => {
      nativeTheme.themeSource = validateThemeSource(source);
      return { ok: true };
    }),
  );

  // Right-click menus drawn by macOS, so they can open past the window's edges.

  ipcMain.handle(
    channels.SET_NAV_COLLAPSED,
    trustedHandler(trust, (event, collapsed) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) fitWindowToNav(win, collapsed === true);
      return { ok: true };
    }),
  );

  ipcMain.handle(
    channels.GET_APP_INFO,
    trustedHandler(trust, () => ({
      name: app.name,
      version: app.getVersion(),
      isPackaged: app.isPackaged,
      platform: process.platform,
    })),
  );

  ipcMain.handle(
    channels.OPEN_EXTERNAL_URL,
    trustedHandler(trust, async (_event, url) => {
      const href = String(url || '').trim();
      let protocol = '';
      try {
        protocol = new URL(href).protocol;
      } catch {
        return { ok: false, reason: 'invalid', message: 'That address cannot be opened.' };
      }
      if (protocol !== 'http:' && protocol !== 'https:') {
        return { ok: false, reason: 'blocked', message: 'That address cannot be opened.' };
      }
      try {
        await shell.openExternal(href);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          reason: 'open_failed',
          message: err instanceof Error ? err.message : 'Could not open the system browser.',
        };
      }
    }),
  );

}

module.exports = { register };
