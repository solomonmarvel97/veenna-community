'use strict';

/** The dictation hotkey, the macOS accessibility and input-monitoring grants, and the Permissions page. */

const { ipcMain, globalShortcut, shell } = require('electron');
const channels = require('../channels.cjs');
const { trustedHandler } = require('../../lib/ipcSecurity.cjs');
const { startDictationHotkeyListener, accessibilityStatus, promptAccessibility } = require('../../dictationHotkeyListener.cjs');
const { inputMonitoringSettingsUrl } = require('../../lib/macosPrivacySettings.cjs');
const systemPermissions = require('../../lib/systemPermissions.cjs');

/** @type {string | null} */
let registeredVoiceHotkey = null;

function acceleratorFromHotkey(hotkey) {
  if (!hotkey || typeof hotkey !== 'object') return null;
  const parts = [];
  if (hotkey.ctrl || hotkey.control) parts.push('Control');
  if (hotkey.alt || hotkey.option) parts.push('Alt');
  if (hotkey.shift) parts.push('Shift');
  if (hotkey.meta || hotkey.cmd || hotkey.command) parts.push('Command');
  const key = String(hotkey.key || '').trim();
  if (!key) return null;
  parts.push(key.length === 1 ? key.toUpperCase() : key);
  return parts.join('+');
}

function unregisterVoiceHotkey() {
  if (registeredVoiceHotkey) {
    globalShortcut.unregister(registeredVoiceHotkey);
    registeredVoiceHotkey = null;
  }
}

function validateHotkey(hotkey) {
  return hotkey && typeof hotkey === 'object' ? hotkey : null;
}

function accessibilitySettingsUrl() {
  if (process.platform === 'darwin') {
    return 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility';
  }
  if (process.platform === 'win32') {
    return 'ms-settings:privacy-accessibility';
  }
  return null;
}

/**
 * @param {{ trust: () => unknown[], getDictationWebContents: () => any, getTrustedWebContentsList: () => any[] }} ctx - from registerHandlers.cjs
 */
function register({ trust, getDictationWebContents }) {
  ipcMain.handle(
    channels.REGISTER_HOTKEY,
    trustedHandler(trust, (_event, hotkey) => {
      unregisterVoiceHotkey();
      if (hotkey == null) return { ok: true, cleared: true };

      const normalized = validateHotkey(hotkey);
      const accelerator = acceleratorFromHotkey(normalized);
      if (!accelerator) return { ok: false, reason: 'invalid_hotkey' };

      const registered = globalShortcut.register(accelerator, () => {
        const wc = getDictationWebContents();
        if (!wc || wc.isDestroyed()) return;
        wc.send('dictation-hotkey', { action: 'toggle-continuous' });
      });

      if (registered) {
        registeredVoiceHotkey = accelerator;
        return { ok: true, accelerator };
      }
      return { ok: false, reason: 'registration_failed' };
    }),
  );

  ipcMain.handle(
    channels.START_DICTATION_HOTKEY,
    trustedHandler(trust, () => {
      promptAccessibility();
      return startDictationHotkeyListener(getDictationWebContents);
    }),
  );

  ipcMain.handle(
    channels.DICTATION_ACCESSIBILITY,
    trustedHandler(trust, () => accessibilityStatus()),
  );

  systemPermissions.setInputMonitoringProbe(() => accessibilityStatus());

  ipcMain.handle(
    channels.OPEN_ACCESSIBILITY_SETTINGS,
    trustedHandler(trust, () => {
      const url = accessibilitySettingsUrl();
      if (url) void shell.openExternal(url);
      else promptAccessibility();
      return { ok: true };
    }),
  );

  ipcMain.handle(
    channels.OPEN_INPUT_MONITORING_SETTINGS,
    trustedHandler(trust, () => {
      const url = inputMonitoringSettingsUrl();
      if (url) void shell.openExternal(url);
      return { ok: Boolean(url) };
    }),
  );

  // The permissions page in Settings. macOS will not let an app grant or revoke
  // anything for itself, so these three are: read the state, trigger the
  // system's own prompt, and put a grant back to never-asked.
  ipcMain.handle(
    channels.PERMISSIONS_LIST,
    trustedHandler(trust, () => systemPermissions.listPermissions()),
  );

  ipcMain.handle(
    channels.PERMISSIONS_REQUEST,
    trustedHandler(trust, (_event, id) => systemPermissions.requestPermission(id)),
  );

  ipcMain.handle(
    channels.PERMISSIONS_RESET,
    trustedHandler(trust, (_event, id) => systemPermissions.resetPermission(id)),
  );

  ipcMain.handle(
    channels.PERMISSIONS_OPEN_SETTINGS,
    trustedHandler(trust, (_event, id) => systemPermissions.openPermissionSettings(id)),
  );

}

module.exports = { register, unregisterVoiceHotkey };
