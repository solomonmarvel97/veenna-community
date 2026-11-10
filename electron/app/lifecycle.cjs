'use strict';

const { app, screen } = require('electron');
const { setupAppProtocol } = require('../lib/protocol.cjs');
const { setupApplicationMenu } = require('../lib/menu.cjs');
const { syncLoginItemFromPreferences } = require('../lib/desktopPreferences.cjs');
const { createOverlayWindow, repositionOverlayForDisplay } = require('../lib/overlayWindow.cjs');
const { registerIpcHandlers, createTrayMenuDeps } = require('../ipc/registerHandlers.cjs');
const { setupTray } = require('../lib/tray.cjs');
const { loadViteDevServer, VITE_DEV_SERVER_URL } = require('../config/app.cjs');
const { attachContentSecurityPolicy } = require('../lib/contentSecurity.cjs');
const { installRequestBlock } = require('../lib/communityLockdown.cjs');
const { setupSessionPermissions } = require('../lib/geolocation.cjs');
const { resolveAppIconPath } = require('../lib/appIcon.cjs');

/**
 * Starts the app: the page protocol, the main window, the dictation HUD window and the
 * dictation shortcut. Nothing here talks to a server, checks for updates or opens a
 * second window beyond the HUD.
 *
 * @param {object} deps
 * @param {boolean} deps.launchedAtLogin
 * @param {() => void} deps.createMainWindow
 * @param {() => void} deps.bootDictationHotkeyListener
 * @param {() => void} deps.updateDockVisibility
 * @param {() => import('electron').WebContents | null} deps.getTrustedWebContentsList
 * @param {() => import('electron').WebContents | null} deps.getDictationWebContents
 * @param {() => import('electron').WebContents | null} [deps.getMainWebContents]
 * @param {() => void} deps.onShowMain
 * @param {() => void} deps.onShowPreferences
 * @param {() => void} deps.onQuit
 */
function registerAppLifecycle(deps) {
  app.whenReady().then(() => {
    installRequestBlock({ allowLoopback: loadViteDevServer });
    setupSessionPermissions();
    attachContentSecurityPolicy({ isDev: loadViteDevServer });
    const iconPath = resolveAppIconPath();
    if (iconPath && process.platform === 'darwin' && app.dock) {
      app.dock.setIcon(iconPath);
    }
    setupAppProtocol();
    syncLoginItemFromPreferences();
    registerIpcHandlers({
      getTrustedWebContentsList: deps.getTrustedWebContentsList,
      getDictationWebContents: deps.getDictationWebContents,
      getMainWebContents: deps.getMainWebContents,
    });
    setupApplicationMenu({
      isDev: loadViteDevServer,
      onPreferences: deps.onShowPreferences,
    });
    setupTray({
      onShowMain: deps.onShowMain,
      onShowPreferences: deps.onShowPreferences,
      onQuit: deps.onQuit,
      ...createTrayMenuDeps({
        getTrustedWebContentsList: deps.getTrustedWebContentsList,
        getDictationWebContents: deps.getDictationWebContents,
        getMainWebContents: deps.getMainWebContents,
      }),
    });
    deps.createMainWindow({ showOnReady: !deps.launchedAtLogin });
    deps.updateDockVisibility();

    // Give the main window a moment to paint before the HUD window and the key monitor start.
    setTimeout(() => {
      createOverlayWindow({ loadViteDevServer, viteDevServerUrl: VITE_DEV_SERVER_URL });
      deps.bootDictationHotkeyListener();

      screen.on('display-metrics-changed', repositionOverlayForDisplay);
      screen.on('display-added', repositionOverlayForDisplay);
      screen.on('display-removed', repositionOverlayForDisplay);
    }, 100);
  });
}

module.exports = {
  registerAppLifecycle,
};
