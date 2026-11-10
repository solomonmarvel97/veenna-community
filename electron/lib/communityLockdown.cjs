'use strict';

/**
 * Community edition: no dictation (audio or text) ever leaves the device, enforced in
 *  layers so no single code path can leak. Reading from the internet is fine; sending
 *  is not. The only reachable hosts are the model host (Hugging Face) and the Community API,
 *  for GET/HEAD only: that is how local speech models are downloaded and how the opt-in update
 *  check reads the signed manifests.
 *
 *  1. Chromium switches (before app ready): every proxied request goes to a dead
 *     address and every host name except loopback and the model hosts fails to resolve.
 *  2. `webRequest.onBeforeRequest` cancels any renderer request that is not the
 *     app's own page, a local file, a GET/HEAD to a model host, or (dev only) the Vite server.
 *  3. The veenna-community:// handler (lib/protocol.cjs) only serves files from disk, and the
 *     lifecycle skips every service that calls home.
 */

const { app, session } = require('electron');
const { isCommunity } = require('../config/edition.cjs');
const { getApiHost } = require('../config/community.cjs');

const SCHEME = 'veenna-community';
const LOCAL_PROTOCOLS = new Set(['file:', 'data:', 'blob:', 'devtools:', 'about:', `${SCHEME}:`]);
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
/** Where speech models come from (see electron/lib/whisperModels.cjs and the model catalog). */
const MODEL_HOSTS = ['huggingface.co', 'hf.co'];
/** The Community API (signed catalog and version manifest): read-only, like the model hosts. */
function readOnlyHosts() {
  const api = getApiHost();
  return api ? [...MODEL_HOSTS, api] : MODEL_HOSTS;
}
const READ_METHODS = new Set(['GET', 'HEAD']);

function isModelHost(hostname) {
  return readOnlyHosts().some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

/** Call before `app.whenReady()`; the switches are ignored afterwards. */
function applyNetworkSwitches() {
  if (!isCommunity) return;
  app.commandLine.appendSwitch('proxy-server', 'socks5://127.0.0.1:9');
  const hosts = readOnlyHosts();
  const open = ['localhost', ...hosts, ...hosts.map((host) => `*.${host}`)];
  app.commandLine.appendSwitch('proxy-bypass-list', open.join(';'));
  app.commandLine.appendSwitch(
    'host-resolver-rules',
    ['MAP * ~NOTFOUND', ...open.map((host) => `EXCLUDE ${host}`)].join(' , '),
  );
  app.commandLine.appendSwitch('disable-background-networking');
}

/**
 * @param {string} rawUrl
 * @param {{ allowLoopback?: boolean, method?: string }} [options] loopback is allowed in dev only (Vite server)
 */
function isAllowedRequest(rawUrl, { allowLoopback = false, method = 'GET' } = {}) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (LOCAL_PROTOCOLS.has(url.protocol)) return true;
  if (['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) {
    if (allowLoopback && LOOPBACK.has(url.hostname)) return true;
    // Read-only access to the model host; nothing can be sent to it.
    return (
      url.protocol === 'https:' &&
      isModelHost(url.hostname) &&
      READ_METHODS.has(String(method).toUpperCase())
    );
  }
  return false;
}

function installRequestBlock({ allowLoopback = false } = {}) {
  if (!isCommunity) return;
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const allowed = isAllowedRequest(details.url, { allowLoopback, method: details.method });
    if (!allowed) console.warn('[community] blocked outbound request:', details.url);
    callback({ cancel: !allowed });
  });
}

module.exports = { applyNetworkSwitches, installRequestBlock, isAllowedRequest };
