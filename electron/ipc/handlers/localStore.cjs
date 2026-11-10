'use strict';

/** The local SQLite store for dictations, reached over IPC. */

const { ipcMain } = require('electron');
const channels = require('../channels.cjs');
const { trustedHandler } = require('../../lib/ipcSecurity.cjs');
const localStore = require('../../lib/localStore/localStore.cjs');

/**
 * Store calls that can throw. Each is [channel, failure reason, call]; a throw becomes
 * `{ ok: false, reason }` so the renderer never sees a rejected promise.
 */
const GUARDED_CALLS = [
  [channels.LOCAL_STORE_UPSERT, 'upsert_failed', (p) => localStore.upsertEntity(p || {})],
  [channels.LOCAL_STORE_DELETE, 'delete_failed', (p) => localStore.deleteEntity(p || {})],
  [channels.LOCAL_STORE_CLEAR_SYNCED, 'clear_synced_failed', () => localStore.clearSyncedEntities()],
  [channels.LOCAL_STORE_BULK_UPSERT, 'bulk_failed', (p) => localStore.bulkUpsert(p || {})],
  [channels.LOCAL_STORE_LIST_ENTITIES, 'list_failed', (p) => localStore.listEntities(p || {})],
  [channels.LOCAL_STORE_GET_APP_SETTING, 'get_setting_failed', (p) => localStore.getAppSetting(p?.key)],
  [
    channels.LOCAL_STORE_SET_APP_SETTING,
    'set_setting_failed',
    (p) => localStore.setAppSetting(p?.key, p?.value),
  ],
];

/** @param {{ trust: () => unknown[] }} ctx */
function register({ trust }) {
  ipcMain.handle(
    channels.LOCAL_STORE_OPEN,
    trustedHandler(trust, (_event, payload) => {
      const userId = typeof payload === 'string' ? payload : payload?.userId;
      return localStore.openLocalStore(userId);
    }),
  );

  ipcMain.handle(
    channels.LOCAL_STORE_CLOSE,
    trustedHandler(trust, () => localStore.closeLocalStore()),
  );

  for (const [channel, failure, call] of GUARDED_CALLS) {
    ipcMain.handle(
      channel,
      trustedHandler(trust, async (_event, payload) => {
        try {
          return await call(payload);
        } catch (error) {
          return { ok: false, reason: error instanceof Error ? error.message : failure };
        }
      }),
    );
  }
}

module.exports = { register };
