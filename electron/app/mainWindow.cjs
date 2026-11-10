'use strict';

const {  BrowserWindow } = require('electron');
const { attachNavigationSecurity } = require('../lib/security.cjs');
const { setMainWindow } = require('../lib/notifications.cjs');
const {
  loadWindowState,
  attachWindowStatePersistence,
} = require('../lib/windowState.cjs');
const { attachWindowListener } = require('../dictationHotkeyListener.cjs');
const { resolveAppIconPath } = require('../lib/appIcon.cjs');
const { attachZoomLimits } = require('../lib/zoom.cjs');
const { SCHEME } = require('../lib/protocol.cjs');
const { PRELOAD_PATH, VITE_DEV_SERVER_URL, loadViteDevServer, WINDOW_DEFAULTS } = require('../config/app.cjs');

/** @typedef {{ showOnReady?: boolean, onShow?: () => void, onHide?: () => void }} CreateMainWindowOptions */

/**
 * @param {object} deps
 * @param {(event?: Electron.Event) => void} deps.onCloseAttempt
 * @param {() => import('electron').WebContents | null} deps.getMainWebContents
 * @param {() => import('electron').WebContents | null} [deps.getDictationWebContents]
 * @param {CreateMainWindowOptions} [options]
 * @returns {import('electron').BrowserWindow}
 */
function createMainWindow(deps, options = {}) {
  const { onCloseAttempt, getMainWebContents, getDictationWebContents } = deps;
  const showOnReady = options.showOnReady ?? true;
  const saved = loadWindowState();
  const iconPath = resolveAppIconPath();

  const mainWindow = new BrowserWindow({
    ...(iconPath ? { icon: iconPath } : {}),
    width: saved.width ?? WINDOW_DEFAULTS.width,
    height: saved.height ?? WINDOW_DEFAULTS.height,
    x: saved.x,
    y: saved.y,
    minWidth: WINDOW_DEFAULTS.minWidth,
    minHeight: WINDOW_DEFAULTS.minHeight,
    resizable: true,
    minimizable: true,
    maximizable: true,
    fullscreenable: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 16, y: 18 } : undefined,
    ...(process.platform === 'darwin' ? { acceptFirstMouse: true } : {}),
    backgroundColor: WINDOW_DEFAULTS.backgroundColor,
    show: false,
    title: WINDOW_DEFAULTS.title,
    webPreferences: {
      preload: PRELOAD_PATH,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: true,
      // Off while the window is visible: Chromium treats it as occluded during
      // the macOS native-fullscreen Spaces animation and would freeze the old,
      // smaller frame on a black canvas. Turned on only while minimised or
      // hidden (see syncThrottling below).
      backgroundThrottling: false,
    },
  });

  // Electron has no will-enter/leave-full-screen event, so throttling cannot
  // be lifted before a native-fullscreen animation starts. Instead it is only
  // applied while the window is minimised or hidden - states that never
  // coincide with the Spaces animation - and lifted the moment it returns.
  // After enter/leave-full-screen it is re-asserted off for a second as a
  // safety net in case the window had been throttled when the transition began.
  const FULLSCREEN_SETTLE_MS = 1000;
  let settleTimer = null;
  const setThrottling = (on) => {
    if (mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return;
    mainWindow.webContents.setBackgroundThrottling(on);
  };
  const idle = () => mainWindow.isMinimized() || !mainWindow.isVisible();
  const syncThrottling = () => {
    clearTimeout(settleTimer);
    setThrottling(idle());
  };
  const holdOffThrottlingBriefly = () => {
    clearTimeout(settleTimer);
    setThrottling(false);
    settleTimer = setTimeout(syncThrottling, FULLSCREEN_SETTLE_MS);
  };
  for (const name of ['minimize', 'hide']) mainWindow.on(name, syncThrottling);
  for (const name of ['restore', 'show']) mainWindow.on(name, () => setThrottling(false));
  for (const name of ['enter-full-screen', 'leave-full-screen']) {
    mainWindow.on(name, holdOffThrottlingBriefly);
  }
  mainWindow.on('closed', () => clearTimeout(settleTimer));

  setMainWindow(mainWindow);
  attachWindowStatePersistence(mainWindow);
  attachZoomLimits(mainWindow.webContents);

  // Dictation started in this window lives in this window: the HUD and Option can't
  // reach it, so leaving the window stops it rather than letting it record unseen.
  for (const name of ['blur', 'hide', 'minimize']) {
    mainWindow.on(name, () => {
      if (mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return;
      mainWindow.webContents.send('dictation-hotkey', { action: 'window-left' });
    });
  }

  if (showOnReady) {
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
      options.onShow?.();
    });
  } else {
    mainWindow.once('ready-to-show', () => options.onShow?.());
  }

  mainWindow.on('show', () => options.onShow?.());
  mainWindow.on('hide', () => options.onHide?.());

  mainWindow.on('close', (event) => {
    onCloseAttempt(event);
  });

  // Route in-window hotkeys to the HUD (owns dictation state on Electron).
  attachWindowListener(getDictationWebContents || getMainWebContents)(mainWindow);

  attachNavigationSecurity(mainWindow, {
    loadViteDevServer,
    viteDevServerUrl: VITE_DEV_SERVER_URL,
  });

  if (loadViteDevServer) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    if (process.env.ELECTRON_OPEN_DEVTOOLS === 'true') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    mainWindow.loadURL(`${SCHEME}://app/`);
  }

  return mainWindow;
}

module.exports = {
  createMainWindow,
};
