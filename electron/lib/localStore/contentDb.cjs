'use strict';

const Database = require('better-sqlite3');
const { applySchema } = require('../../db/schema.cjs');
const { hashSearchText, validateEntityType } = require('./entityTypes.cjs');
const { redactFreeText } = require('../piiRedact.cjs');

function openContentDb(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  applySchema(db);
  return db;
}

function upsertEntity(db, row) {
  const entityType = validateEntityType(row.entityType);
  const id = String(row.id || '').trim();
  if (!id) throw new Error('entity id required');

  const searchText = redactFreeText(String(row.searchText || '').trim());
  const payloadJson = JSON.stringify(row.payload ?? {});
  const contentHash = hashSearchText(searchText);
  const updatedAt = String(row.updatedAt || new Date().toISOString());
  const userId = String(row.userId || '').trim();

  db.prepare(
    `INSERT INTO entities (
      entity_type, id, user_id, payload_json, search_text, content_hash,
      updated_at, deleted_at, server_rev
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)
    ON CONFLICT(entity_type, id) DO UPDATE SET
      user_id = excluded.user_id,
      payload_json = excluded.payload_json,
      search_text = excluded.search_text,
      content_hash = excluded.content_hash,
      updated_at = excluded.updated_at,
      deleted_at = NULL,
      server_rev = excluded.server_rev`,
  ).run(
    entityType,
    id,
    userId,
    payloadJson,
    searchText,
    contentHash,
    updatedAt,
    row.serverRev ?? null,
  );

  db.prepare(`DELETE FROM entities_fts WHERE entity_type = ? AND entity_id = ?`).run(entityType, id);
  db.prepare(`INSERT INTO entities_fts(entity_type, entity_id, search_text) VALUES (?, ?, ?)`).run(
    entityType,
    id,
    searchText,
  );

  let payload = row.payload ?? null;
  if (!payload) {
    try {
      payload = JSON.parse(payloadJson);
    } catch {
      payload = null;
    }
  }

  return { entityType, id, contentHash, searchText, updatedAt, payload };
}

function deleteEntity(db, entityType, id) {
  const type = validateEntityType(entityType);
  const entityId = String(id || '').trim();
  if (!entityId) return false;
  const result = db
    .prepare(
      `UPDATE entities SET deleted_at = ?, updated_at = ? WHERE entity_type = ? AND id = ? AND deleted_at IS NULL`,
    )
    .run(new Date().toISOString(), new Date().toISOString(), type, entityId);
  if (result.changes > 0) {
    db.prepare(`DELETE FROM entities_fts WHERE entity_type = ? AND entity_id = ?`).run(type, entityId);
  }
  return result.changes > 0;
}

/** Soft-delete every synced entity type and clear FTS rows. */
function clearAllSyncedEntities(db) {
  const now = new Date().toISOString();
  const types = [...require('./entityTypes.cjs').ENTITY_TYPES];
  const result = db
    .prepare(
      `UPDATE entities SET deleted_at = ?, updated_at = ?
       WHERE deleted_at IS NULL AND entity_type IN (${types.map(() => '?').join(',')})`,
    )
    .run(now, now, ...types);
  db.prepare(`DELETE FROM entities_fts`).run();
  return { cleared: result.changes || 0 };
}

function getEntity(db, entityType, id) {
  const type = validateEntityType(entityType);
  const row = db
    .prepare(
      `SELECT * FROM entities WHERE entity_type = ? AND id = ? AND deleted_at IS NULL LIMIT 1`,
    )
    .get(type, String(id));
  if (!row) return null;
  let payload = null;
  try {
    payload = JSON.parse(row.payload_json);
  } catch {
    payload = null;
  }
  return {
    entityType: row.entity_type,
    id: row.id,
    userId: row.user_id,
    payload,
    searchText: row.search_text,
    contentHash: row.content_hash,
    updatedAt: row.updated_at,
  };
}

function bulkUpsertEntities(db, userId, entities) {
  const tx = db.transaction((rows) => {
    const results = [];
    for (const row of rows) {
      results.push(
        upsertEntity(db, {
          ...row,
          userId,
        }),
      );
    }
    return results;
  });
  return tx(entities || []);
}

function countEntities(db) {
  const row = db
    .prepare(`SELECT COUNT(*) AS count FROM entities WHERE deleted_at IS NULL`)
    .get();
  return Number(row?.count || 0);
}

function listEntitiesForTypes(db, types) {
  const placeholders = types.map(() => '?').join(', ');
  return db
    .prepare(
      `SELECT entity_type, id, payload_json, search_text, updated_at
       FROM entities
       WHERE deleted_at IS NULL AND entity_type IN (${placeholders})`,
    )
    .all(...types);
}

/**
 * One page of entities, ordered so paging is stable.
 *
 * better-sqlite3 is synchronous and this runs in the main process, which is
 * also Chromium's browser process - reading a whole large table in one call
 * stalls input routing for every window. Callers page and yield between pages.
 */
function listEntitiesForTypesPage(db, types, limit, offset) {
  const placeholders = types.map(() => '?').join(', ');
  return db
    .prepare(
      `SELECT entity_type, id, payload_json, search_text, updated_at
       FROM entities
       WHERE deleted_at IS NULL AND entity_type IN (${placeholders})
       ORDER BY rowid
       LIMIT ? OFFSET ?`,
    )
    .all(...types, limit, offset);
}

function getAppSetting(db, key) {
  const settingKey = String(key || '').trim();
  if (!settingKey) return null;
  const row = db
    .prepare(`SELECT value_json FROM app_settings WHERE key = ? LIMIT 1`)
    .get(settingKey);
  if (!row?.value_json) return null;
  try {
    return JSON.parse(row.value_json);
  } catch {
    return null;
  }
}

function setAppSetting(db, key, value) {
  const settingKey = String(key || '').trim();
  if (!settingKey) throw new Error('setting key required');
  db.prepare(
    `INSERT INTO app_settings (key, value_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value_json = excluded.value_json,
       updated_at = excluded.updated_at`,
  ).run(settingKey, JSON.stringify(value ?? null), new Date().toISOString());
  return { key: settingKey };
}

module.exports = {
  openContentDb,
  upsertEntity,
  deleteEntity,
  clearAllSyncedEntities,
  getEntity,
  bulkUpsertEntities,
  countEntities,
  listEntitiesForTypes,
  listEntitiesForTypesPage,
  getAppSetting,
  setAppSetting,
};
