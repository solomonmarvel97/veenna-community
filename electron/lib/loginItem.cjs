'use strict';

const { app } = require('electron');

const LOGIN_LAUNCH_ARG = '--login-launch';

function isLoginLaunch() {
  return process.argv.includes(LOGIN_LAUNCH_ARG) || app.getLoginItemSettings().wasOpenedAtLogin;
}

function readLoginItemSettings() {
  try {
    return app.getLoginItemSettings();
  } catch {
    return { openAtLogin: false, openAsHidden: false, wasOpenedAtLogin: false };
  }
}

function applyOpenAtLogin(enabled) {
  if (!app.isPackaged && process.env.ELECTRON_ALLOW_LOGIN_ITEM !== 'true') {
    return {
      ok: false,
      reason: 'dev_mode',
      openAtLogin: false,
    };
  }

  try {
    app.setLoginItemSettings({
      openAtLogin: Boolean(enabled),
      openAsHidden: Boolean(enabled),
      args: enabled ? [LOGIN_LAUNCH_ARG] : [],
      name: app.name,
    });
    const current = readLoginItemSettings();
    return { ok: true, openAtLogin: current.openAtLogin, openAsHidden: current.openAsHidden };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'login_item_failed',
      openAtLogin: false,
    };
  }
}

module.exports = {
  LOGIN_LAUNCH_ARG,
  isLoginLaunch,
  readLoginItemSettings,
  applyOpenAtLogin,
};
