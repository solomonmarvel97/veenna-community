'use strict';

const { getContentDbPath, ensureUserLocalDir } = require('../../db/paths.cjs');
const contentDb = require('./contentDb.cjs');
const { ENTITY_TYPES, validateEntityType } = require('./entityTypes.cjs');

/**
 * The on-device database for Veenna Community: the saved dictations and a few app
 * settings, in one SQLite file under the app's own data folder. There is no search index and
 * nothing is ever sent anywhere.
 *
 * @type {null | { userId: string, content: import('better-sqlite3').Database }}
 */
let session = null;

function openLocalStore(userId) {
  const uid = String(userId || '').trim();
  if (!uid) return { ok: false, reason: 'missing_user_id' };
  if (session?.userId === uid) return { ok: true, userId: uid, reopened: true };

  closeLocalStore();

  ensureUserLocalDir(uid);
  const contentPath = getContentDbPath(uid);
  if (!contentPath) return { ok: false, reason: 'invalid_paths' };

  session = { userId: uid, content: contentDb.openContentDb(contentPath) };
  return { ok: true, userId: uid };
}

function closeLocalStore() {
  if (!session) return { ok: true };
  try {
    session.content.close();
  } catch {
    /* ignore */
  }
  session = null;
  return { ok: true };
}

function requireSession() {
  if (!session) throw new Error('local store not open');
  return session;
}

function upsertEntity(payload) {
  const { content, userId } = requireSession();
  const entityType = validateEntityType(payload.type);
  const result = contentDb.upsertEntity(content, {
    entityType,
    id: payload.id,
    userId,
    payload: payload.payload,
    searchText: payload.searchText,
    updatedAt: payload.updatedAt,
    serverRev: payload.serverRev,
  });
  return { ok: true, ...result };
}

function deleteEntity(payload) {
  const { content } = requireSession();
  const entityType = validateEntityType(payload.type);
  return { ok: contentDb.deleteEntity(content, entityType, payload.id) };
}

function clearSyncedEntities() {
  const { content } = requireSession();
  const contentResult = contentDb.clearAllSyncedEntities(content);
  return { ok: true, entitiesCleared: contentResult.cleared };
}

function bulkUpsert(payload) {
  const { content, userId } = requireSession();
  const rows = Array.isArray(payload.entities) ? payload.entities : [];
  const results = contentDb.bulkUpsertEntities(
    content,
    userId,
    rows.map((row) => ({
      entityType: row.type,
      id: row.id,
      payload: row.payload,
      searchText: row.searchText,
      updatedAt: row.updatedAt,
      serverRev: row.serverRev,
    })),
  );
  return { ok: true, count: results.length };
}

async function listEntities(payload) {
  const { content } = requireSession();
  const types = Array.isArray(payload?.types)
    ? payload.types.map((type) => validateEntityType(type))
    : [...ENTITY_TYPES];
  // Read and parse in pages, yielding between them. This runs on the main process thread,
  // which also routes input for every window: one big synchronous read is felt as the whole
  // app refusing clicks.
  const entities = [];
  const page = 200;
  for (let offset = 0; ; offset += page) {
    const rows = contentDb.listEntitiesForTypesPage(content, types, page, offset);
    if (!rows.length) break;
    for (const row of rows) {
      let entityPayload = null;
      try {
        entityPayload = JSON.parse(row.payload_json);
      } catch {
        entityPayload = null;
      }
      entities.push({
        type: row.entity_type,
        id: row.id,
        payload: entityPayload,
        searchText: row.search_text,
        updatedAt: row.updated_at,
      });
    }
    if (rows.length < page) break;
    await new Promise((resolve) => setImmediate(resolve));
  }
  return { ok: true, entities };
}

function getStatus() {
  if (!session) return { ok: true, open: false, entityCount: 0 };
  return {
    ok: true,
    open: true,
    userId: session.userId,
    entityCount: contentDb.countEntities(session.content),
  };
}

function getAppSetting(key) {
  const { content } = requireSession();
  const settingKey = String(key || '').trim();
  if (!settingKey) return { ok: false, reason: 'missing_key' };
  return { ok: true, value: contentDb.getAppSetting(content, settingKey) };
}

function setAppSetting(key, value) {
  const { content } = requireSession();
  const settingKey = String(key || '').trim();
  if (!settingKey) return { ok: false, reason: 'missing_key' };
  contentDb.setAppSetting(content, settingKey, value);
  return { ok: true };
}

module.exports = {
  openLocalStore,
  closeLocalStore,
  upsertEntity,
  deleteEntity,
  clearSyncedEntities,
  bulkUpsert,
  listEntities,
  getStatus,
  getAppSetting,
  setAppSetting,
};
