'use strict';

const { session } = require('electron');
const { VEENNA_APP_CSP, VEENNA_APP_CSP_DEV } = require('../config/csp.cjs');
const { SCHEME } = require('./protocol.cjs');

/**
 * Our policy belongs to our documents only.
 *
 * onHeadersReceived fires for every response the app makes, embedded pages
 * included, so this used to stamp our policy onto third-party responses and
 * replace whatever protection they shipped with one written for our origin.
 *
 * That is not just impolite, it broke embedding outright. The production policy
 * carries `frame-ancestors 'none'`, which tells the browser a document may not
 * be framed by anyone. Applied to a worker computer's noVNC page, the frame
 * rendered empty. Dev never showed it because the dev policy has no
 * frame-ancestors, and the meta-tag path strips it (browsers ignore it there),
 * so the header was the only place it ever took effect.
 */
function isOwnDocument(url) {
  const value = String(url || '');
  if (value.startsWith(`${SCHEME}://`)) return true;
  if (value.startsWith('file://')) return true;
  // The Vite dev server, however it is addressed.
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(value);
}

function attachContentSecurityPolicy({ isDev = false } = {}) {
  const policy = isDev ? VEENNA_APP_CSP_DEV : VEENNA_APP_CSP;

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (!isOwnDocument(details.url)) {
      // Pass the response through exactly as it arrived.
      callback({});
      return;
    }
    const headers = { ...details.responseHeaders };
    headers['Content-Security-Policy'] = [policy];
    callback({ responseHeaders: headers });
  });
}

module.exports = { attachContentSecurityPolicy, isOwnDocument };
