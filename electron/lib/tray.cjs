'use strict';

const path = require('path');
const fs = require('fs');
const { Tray, Menu, nativeImage,  } = require('electron');

/** @type {import('electron').Tray | null} */
let tray = null;

/** @type {'idle' | 'recording' | 'processing' | 'error'} */
let currentState = 'idle';

/** @type {object | null} */
let menuDeps = null;

const TRAY_TOOLTIPS = {
  idle: 'Veenna Community - dictation ready',
  recording: 'Veenna Community - dictating…',
  processing: 'Veenna Community - transcribing…',
  error: 'Veenna Community - dictation error',
};

function trayAssetDir() {
  return path.join(__dirname, '../../build/tray');
}

function resolveTrayIconPath(state) {
  const base = path.join(trayAssetDir(), `tray-${state}.png`);
  if (fs.existsSync(base)) return base;

  const fallbacks = [
    path.join(trayAssetDir(), 'tray-idle.png'),
    path.join(__dirname, '../../build/icon.png'),
    path.join(__dirname, '../../public/logo.png'),
    path.join(__dirname, '../../public/favicon.png'),
    path.join(__dirname, '../../dist/logo.png'),
  ];
  for (const candidate of fallbacks) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function loadTrayImage(state) {
  const iconPath = resolveTrayIconPath(state);
  if (!iconPath) return nativeImage.createEmpty();

  const image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) return nativeImage.createEmpty();

  return image;
}

function applyTrayAppearance() {
  if (!tray) return;
  tray.setImage(loadTrayImage(currentState));
  tray.setToolTip(TRAY_TOOLTIPS[currentState] || TRAY_TOOLTIPS.idle);
}

function rebuildTrayMenu() {
  if (!tray || !menuDeps) return;

  const hudIdleVisible = menuDeps.isHudIdleVisible?.() ?? true;
  const processing = currentState === 'processing';
  const recording = currentState === 'recording';
  const recordingLabel = recording ? 'Stop & process' : 'Start recording';

  /** @type {import('electron').MenuItemConstructorOptions[]} */
  const template = [
    {
      label: 'Open Veenna Community',
      click: () => menuDeps.onShowMain?.(),
    },
    { type: 'separator' },
    {
      label: recordingLabel,
      enabled: !processing,
      click: () => menuDeps.onTrayDictationAction?.('recording'),
    },
    {
      type: 'checkbox',
      label: 'Show HUD when idle',
      checked: hudIdleVisible,
      click: (item) => menuDeps.onTrayHudIdleVisible?.(Boolean(item.checked)),
    },
    { type: 'separator' },
    {
      label: 'Preferences…',
      click: () => menuDeps.onShowPreferences?.(),
    },
    { type: 'separator' },
    {
      label: 'Quit Veenna Community',
      click: () => menuDeps.onQuit?.(),
    },
  ];

  tray.setContextMenu(Menu.buildFromTemplate(template));
}

function setTrayMenuDeps(deps) {
  menuDeps = deps;
  rebuildTrayMenu();
}

function notifyTrayMenuChanged() {
  rebuildTrayMenu();
}

/**
 * @param {string} state
 */
function setTrayDictationState(state) {
  const next = ['idle', 'recording', 'processing', 'error'].includes(state) ? state : 'idle';
  if (currentState === next) return;
  currentState = next;
  applyTrayAppearance();
  rebuildTrayMenu();
}

function getTrayDictationState() {
  return { state: currentState };
}

function setupTray(deps) {
  if (tray) {
    setTrayMenuDeps(deps);
    return tray;
  }

  currentState = 'idle';
  tray = new Tray(loadTrayImage('idle'));
  applyTrayAppearance();
  setTrayMenuDeps(deps);

  // macOS: setContextMenu already opens the menu on left-click. Also calling
  // onShowMain() focuses the main window and immediately dismisses that menu.
  // Right-click worked because it only opens the menu.
  // Windows/Linux: left-click shows the app; context menu stays on right-click.
  if (process.platform !== 'darwin') {
    tray.on('click', () => deps.onShowMain?.());
    tray.on('double-click', () => deps.onShowMain?.());
  }

  return tray;
}

function destroyTray() {
  tray?.destroy();
  tray = null;
  menuDeps = null;
  currentState = 'idle';
}

module.exports = {
  setupTray,
  destroyTray,
  setTrayDictationState,
  getTrayDictationState,
  notifyTrayMenuChanged,
};
