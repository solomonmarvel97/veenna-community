'use strict';

/** Community edition: the .veennapack export and the opt-in update check. */

const fs = require('fs');
const path = require('path');
const { ipcMain, shell, app } = require('electron');
const channels = require('../channels.cjs');
const { trustedHandler } = require('../../lib/ipcSecurity.cjs');

/**
 * @param {{ trust: () => unknown[], getDictationWebContents: () => any, getTrustedWebContentsList: () => any[] }} ctx - from registerHandlers.cjs
 */
function register({ trust }) {
  // Community edition migration: the renderer builds the .veennapack and the main process
  // only writes it, to a fixed folder the commercial app also looks in.
  ipcMain.handle(
    channels.COMMUNITY_SAVE_PACK,
    trustedHandler(trust, async (_event, bytes, options) => {
      if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
        return { ok: false, reason: 'empty', message: 'There is nothing to export yet.' };
      }
      try {
        const dir = path.join(app.getPath('documents'), 'Veenna Migration');
        fs.mkdirSync(dir, { recursive: true });
        const stamp = new Date().toISOString().slice(0, 19).split(':').join('-');
        const file = path.join(dir, `Veenna-Community-${stamp}.veennapack`);
        fs.writeFileSync(file, bytes);
        if (options?.reveal !== false) shell.showItemInFolder(file);
        return { ok: true, path: file };
      } catch (err) {
        return {
          ok: false,
          reason: 'write_failed',
          message: err instanceof Error ? err.message : 'Could not save the file.',
        };
      }
    }),
  );

  // Opt-in update check: only when the person presses the button. Two GETs to the Community API;
  // nothing from this device is sent. Replies are accepted only if their signature verifies.
  ipcMain.handle(
    channels.COMMUNITY_CHECK_UPDATES,
    trustedHandler(trust, async () => {
      const { net } = require('electron');
      const { checkOnline } = require('../lib/remoteManifest.cjs');
      const { getApiBaseUrl, MANIFEST_PUBLIC_KEYS } = require('../config/community.cjs');
      const catalog = require('../../src/lib/voice/whisper-model-catalog.json');
      return checkOnline({
        apiBase: getApiBaseUrl(),
        publicKeys: MANIFEST_PUBLIC_KEYS,
        currentVersion: app.getVersion(),
        knownModelIds: catalog.map((entry) => entry.id),
        fetchText: async (url) => {
          const res = await net.fetch(url, {
            method: 'GET',
            cache: 'no-store',
            credentials: 'omit',
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        },
      });
    }),
  );

}

module.exports = { register };
