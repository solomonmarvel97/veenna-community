'use strict';

const { Notification, app } = require('electron');
const channels = require('../ipc/channels.cjs');

/** @type {import('electron').BrowserWindow | null} */
let mainWindowRef = null;

function setMainWindow(window) {
  mainWindowRef = window;
}

function getMainWindow() {
  return mainWindowRef && !mainWindowRef.isDestroyed() ? mainWindowRef : null;
}

function focusMainWindow() {
  const win = mainWindowRef;
  if (!win || win.isDestroyed()) return false;
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  win.focus();
  if (process.platform === 'darwin') app.focus({ steal: true });
  return true;
}

function sanitizeText(value, maxLen = 500) {
  return String(value ?? '')
    .trim()
    .slice(0, maxLen);
}

/**
 * Show a native notification. Clicking focuses the app and notifies the renderer.
 * @param {{ title?: string, body?: string, itemId?: string, link?: string }} payload
 */
function showNativeNotification(payload = {}) {
  if (!Notification.isSupported()) return { ok: false, reason: 'unsupported' };

  const title = sanitizeText(payload.title, 120) || 'veenna';
  const body = sanitizeText(payload.body, 500);
  const itemId = payload.itemId ? sanitizeText(payload.itemId, 64) : undefined;
  const linkRaw = typeof payload.link === 'string' ? payload.link.trim() : '';
  const link = linkRaw.startsWith('/') ? sanitizeText(linkRaw, 512) : undefined;

  const notification = new Notification({
    title,
    body,
    silent: false,
  });

  notification.on('click', () => {
    focusMainWindow();
    const win = mainWindowRef;
    if (win && !win.isDestroyed()) {
      win.webContents.send(channels.NOTIFICATION_CLICK, {
        itemId: itemId || null,
        link: link || null,
      });
    }
  });

  notification.show();
  return { ok: true };
}

function setAppBadge(count) {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) {
    if (process.platform === 'darwin') app.dock?.setBadge('');
    else app.setBadgeCount(0);
    return;
  }
  const badge = Math.min(Math.floor(n), 99);
  if (process.platform === 'darwin') {
    app.dock?.setBadge(String(badge));
    return;
  }
  app.setBadgeCount(badge);
}

module.exports = {
  setMainWindow,
  getMainWindow,
  focusMainWindow,
  showNativeNotification,
  setAppBadge,
};
