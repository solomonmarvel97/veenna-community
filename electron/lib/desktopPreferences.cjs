'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { applyOpenAtLogin, readLoginItemSettings } = require('./loginItem.cjs');

const DEFAULTS = {
  openAtLogin: true,
  guestSession: false,
};

function preferencesPath() {
  return path.join(app.getPath('userData'), 'desktop-preferences.json');
}

function loadDesktopPreferences() {
  try {
    const raw = fs.readFileSync(preferencesPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return { ...DEFAULTS, ...parsed };
    }
  } catch {
    /* first launch */
  }
  return { ...DEFAULTS };
}

function saveDesktopPreferences(preferences) {
  fs.writeFileSync(preferencesPath(), JSON.stringify(preferences, null, 2), 'utf8');
}

function syncLoginItemFromPreferences() {
  const preferences = loadDesktopPreferences();
  const result = applyOpenAtLogin(preferences.openAtLogin);
  return { preferences, result };
}

function setOpenAtLogin(enabled) {
  const requested = Boolean(enabled);
  const preferences = { ...loadDesktopPreferences(), openAtLogin: requested };
  saveDesktopPreferences(preferences);
  const result = applyOpenAtLogin(preferences.openAtLogin);

  if (!result.ok && result.reason === 'dev_mode') {
    return {
      ok: true,
      reason: 'dev_mode',
      openAtLogin: preferences.openAtLogin,
      requested: preferences.openAtLogin,
    };
  }

  const system = readLoginItemSettings();
  return {
    ok: result.ok,
    reason: result.reason,
    openAtLogin: result.ok ? preferences.openAtLogin : system.openAtLogin,
    requested: preferences.openAtLogin,
  };
}

function getOpenAtLoginStatus() {
  const preferences = loadDesktopPreferences();
  const system = readLoginItemSettings();
  return {
    openAtLogin: preferences.openAtLogin,
    systemOpenAtLogin: system.openAtLogin,
    wasOpenedAtLogin: system.wasOpenedAtLogin,
    canRegister: app.isPackaged || process.env.ELECTRON_ALLOW_LOGIN_ITEM === 'true',
  };
}

module.exports = {
  loadDesktopPreferences,
  saveDesktopPreferences,
  syncLoginItemFromPreferences,
  setOpenAtLogin,
  getOpenAtLoginStatus,
};
