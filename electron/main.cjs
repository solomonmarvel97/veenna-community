'use strict';

// Guard against electron-builder loading this file during build under Bun.
// When running under Bun, the electron module is not available, so exit early.
if (typeof Bun !== 'undefined') {
  module.exports = {};
  return;
}

// First, before anything can log: a closed stdout/stderr pipe must not crash the app.
require('./lib/stdioGuard.cjs').guardStdio();

const { app } = require('electron');
const { APP_NAME } = require('./config/app.cjs');

// electron:dev runs the stock Electron binary - without this the menu bar shows "Electron".
app.setName(APP_NAME);

// Veenna Community sends nothing over the network: this must run before the app is ready.
require('./lib/communityLockdown.cjs').applyNetworkSwitches();

// Development only, and only when asked for: lets a local script drive the window.
// Never set in a packaged app.
if (
  app &&
  process.env.ELECTRON_DEV === 'true' &&
  !app.isPackaged &&
  process.env.VEENNA_REMOTE_DEBUG_PORT
) {
  app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
  app.commandLine.appendSwitch('remote-debugging-port', String(process.env.VEENNA_REMOTE_DEBUG_PORT));
}

// The app stores no cookies, logins or secrets, so Chromium's "Safe Storage" key is pointless here
// and macOS would otherwise ask for the login keychain password on first launch.
if (app && process.platform === 'darwin') app.commandLine.appendSwitch('use-mock-keychain');

const { registerPrivilegedScheme } = require('./lib/protocol.cjs');
const { getOverlayWebContents, destroyOverlayWindow } = require('./lib/overlayWindow.cjs');
const { destroyTray } = require('./lib/tray.cjs');
const { cleanupIpcResources } = require('./ipc/registerHandlers.cjs');
const channels = require('./ipc/channels.cjs');
const { restoreSystemAudio } = require('./lib/audioDuck.cjs');
const {
  startDictationHotkeyListener,
  stopDictationHotkeyListener,
} = require('./dictationHotkeyListener.cjs');
const { isLoginLaunch } = require('./lib/loginItem.cjs');
const { createMainWindow } = require('./app/mainWindow.cjs');
const { registerAppLifecycle } = require('./app/lifecycle.cjs');

// Keep electron:dev from fighting an installed copy's lock and profile.
if (app && process.env.ELECTRON_DEV === 'true') {
  const base = app.getPath('userData');
  const devUserData = base.endsWith('-dev') ? base : `${base}-dev`;
  app.setPath('userData', devUserData);
  console.log(`[community] ELECTRON_DEV userData → ${devUserData}`);
}

const launchedAtLogin = isLoginLaunch();

/** @type {import('electron').BrowserWindow | null} */
let mainWindow = null;

app.isQuitting = false;

function getMainWebContents() {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  return mainWindow.webContents;
}

function getDictationWebContents() {
  const overlay = getOverlayWebContents();
  if (overlay && !overlay.isDestroyed()) return overlay;
  return getMainWebContents();
}

function getTrustedWebContentsList() {
  return [getMainWebContents(), getOverlayWebContents()];
}

function sendOpenSettingsModal(tab = 'general') {
  const wc = getMainWebContents();
  if (!wc || wc.isDestroyed()) return;
  const payload = { tab };
  const deliver = () => {
    if (wc.isDestroyed()) return;
    try {
      wc.send(channels.OPEN_SETTINGS_MODAL, payload);
    } catch {
      /* tearing down */
    }
  };
  if (wc.isLoading()) {
    wc.once('did-finish-load', deliver);
    return;
  }
  deliver();
}

function showMainWindowWithSettings(tab = 'general') {
  if (!mainWindow || mainWindow.isDestroyed()) {
    bootMainWindow({ showOnReady: true });
    mainWindow?.once('ready-to-show', () => sendOpenSettingsModal(tab));
    return;
  }
  showMainWindow();
  sendOpenSettingsModal(tab);
}

function updateDockVisibility() {
  if (process.platform !== 'darwin') return;
  const mainVisible = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible();
  if (mainVisible) app.dock.show();
  else app.dock.hide();
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    bootMainWindow({ showOnReady: true });
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  updateDockVisibility();
}

function bootMainWindow({ showOnReady } = { showOnReady: !launchedAtLogin }) {
  mainWindow = createMainWindow(
    {
      onCloseAttempt(event) {
        if (!app.isQuitting) {
          event.preventDefault();
          mainWindow?.hide();
          updateDockVisibility();
        }
      },
      getMainWebContents,
      getDictationWebContents,
    },
    {
      showOnReady,
      onShow: updateDockVisibility,
      onHide: updateDockVisibility,
    },
  );
}

function bootDictationHotkeyListener() {
  if (process.platform === 'darwin') {
    const trusted = require('electron').systemPreferences.isTrustedAccessibilityClient(false);
    if (!trusted) {
      // No prompt at launch: asking is left to the dictation settings. Start the monitor
      // anyway; without Accessibility it waits for the grant and exits to be restarted with it.
      console.log('[dictation-hotkey] Accessibility not enabled yet; monitor will wait for it.');
    }
  }

  const result = startDictationHotkeyListener(getDictationWebContents);
  if (!result.ok && result.reason !== 'unsupported_or_running') {
    console.warn('[dictation-hotkey] Listener failed to start:', result.reason);
  }
}

function requestQuit() {
  app.isQuitting = true;
  destroyOverlayWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
    mainWindow = null;
  }
  app.quit();
}

registerPrivilegedScheme();

if (app) {
  const gotSingleInstanceLock = app.requestSingleInstanceLock();
  if (!gotSingleInstanceLock) {
    console.error('[community] Another Veenna Community is already running.');
    app.quit();
  } else {
    app.on('second-instance', () => showMainWindow());

    registerAppLifecycle({
      launchedAtLogin,
      createMainWindow: bootMainWindow,
      bootDictationHotkeyListener,
      updateDockVisibility,
      getTrustedWebContentsList,
      getDictationWebContents,
      getMainWebContents,
      onShowMain: showMainWindow,
      onShowPreferences: () => showMainWindowWithSettings(),
      onQuit: requestQuit,
    });
  }
}

if (app) {
  app.on('before-quit', () => {
    app.isQuitting = true;
    destroyOverlayWindow();
  });

  app.on('will-quit', () => {
    void restoreSystemAudio();
    cleanupIpcResources();
    stopDictationHotkeyListener();
    destroyTray();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      if (!getOverlayWebContents()) app.quit();
    }
  });

  app.on('activate', () => {
    showMainWindow();
  });

  // Coming back to the app (often straight from System Settings after a grant) brings a
  // stopped Option monitor back. A running one makes this a no-op.
  app.on('browser-window-focus', () => {
    if (process.platform !== 'darwin' || app.isQuitting) return;
    startDictationHotkeyListener(getDictationWebContents);
  });
}
