'use strict';

const { shell } = require('electron');
const { SCHEME } = require('./protocol.cjs');
const { classifyOutboundUrl } = require('./outboundUrl.cjs');

function isAllowedNavigationUrl(url, { loadViteDevServer, viteDevServerUrl } = {}) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === `${SCHEME}:`) return true;
    if (loadViteDevServer && viteDevServerUrl && parsed.origin === new URL(viteDevServerUrl).origin) {
      return true;
    }
    if (parsed.protocol === 'about:') return parsed.pathname === 'blank' || url === 'about:blank';
    return false;
  } catch {
    return false;
  }
}

function isSafeExternalUrl(url) {
  try {
    const protocol = new URL(url).protocol;
    return protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:';
  } catch {
    return false;
  }
}

/** Links go to the person's own browser; the app has no browser of its own. */
function openHttpInAppBrowser(url) {
  try {
    void shell.openExternal(url);
  } catch {
    /* ignore */
  }
  return false;
}

function attachNavigationSecurity(window, options) {
  const wc = window.webContents;

  wc.on('will-navigate', (event, url) => {
    const kind = classifyOutboundUrl(url, options);
    if (kind === 'app') return;
    event.preventDefault();
    if (kind === 'browser') openHttpInAppBrowser(url);
    else if (kind === 'external') void shell.openExternal(url);
  });

  wc.setWindowOpenHandler(({ url }) => {
    const kind = classifyOutboundUrl(url, options);
    if (kind === 'app') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          webPreferences: {
            sandbox: true,
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            preload: '',
          },
        },
      };
    }
    if (kind === 'browser') openHttpInAppBrowser(url);
    else if (kind === 'external') void shell.openExternal(url);
    return { action: 'deny' };
  });

  wc.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
    }
  });

  wc.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[renderer:did-fail-load] ${errorCode} ${errorDescription} ${validatedURL}`);
  });

  wc.on('render-process-gone', (_event, details) => {
    console.error('[renderer:gone]', details);
  });
}

module.exports = {
  attachNavigationSecurity,
  isAllowedNavigationUrl,
  isSafeExternalUrl,
  classifyOutboundUrl,
};
