'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const contentDb = require('../lib/localStore/contentDb.cjs');
const { SCHEMA_VERSION } = require('./schema.cjs');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'veenna-local-'));
}

test('a fresh database gets the schema and entities round-trip', () => {
  const dir = tempDir();
  const content = contentDb.openContentDb(path.join(dir, 'content.db'));
  try {
    const tables = content
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
      .all()
      .map((row) => row.name);
    assert.ok(tables.includes('entities'));
    assert.ok(tables.includes('entities_fts'));
    assert.ok(tables.includes('app_settings'));
    assert.equal(content.pragma('user_version', { simple: true }), SCHEMA_VERSION);

    contentDb.upsertEntity(content, {
      entityType: 'voice_capture',
      id: 'cap-1',
      userId: 'local',
      payload: { text: 'hello' },
      searchText: 'hello',
      updatedAt: new Date().toISOString(),
    });
    assert.equal(contentDb.countEntities(content), 1);
    assert.ok(contentDb.getEntity(content, 'voice_capture', 'cap-1'));
    contentDb.deleteEntity(content, 'voice_capture', 'cap-1');
    assert.equal(contentDb.countEntities(content), 0);
  } finally {
    content.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('reopening a database keeps its data', () => {
  const dir = tempDir();
  const file = path.join(dir, 'content.db');
  try {
    let content = contentDb.openContentDb(file);
    contentDb.setAppSetting(content, 'k', { a: 1 });
    content.close();
    content = contentDb.openContentDb(file);
    assert.deepEqual(contentDb.getAppSetting(content, 'k'), { a: 1 });
    content.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a database made by the old numbered migrations opens with its captures intact', () => {
  const dir = tempDir();
  const file = path.join(dir, 'content.db');
  try {
    const old = new Database(file);
    old.exec(`
      CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE entities (
        entity_type TEXT NOT NULL, id TEXT NOT NULL, user_id TEXT NOT NULL,
        payload_json TEXT NOT NULL, search_text TEXT NOT NULL, content_hash TEXT NOT NULL,
        updated_at TEXT NOT NULL, deleted_at TEXT, server_rev TEXT,
        PRIMARY KEY (entity_type, id)
      );
      INSERT INTO entities VALUES ('voice_capture', 'old-1', 'local', '{}', 'old', 'h', 'now', NULL, NULL);
    `);
    old.close();
    const content = contentDb.openContentDb(file);
    assert.equal(contentDb.countEntities(content), 1);
    content.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
