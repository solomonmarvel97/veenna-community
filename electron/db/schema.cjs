'use strict';

/**
 * The local database: one SQLite file per profile, holding dictation captures.
 *
 * The whole schema lives here. `user_version` records that it has been applied, so a fresh file is
 * built on first open and an existing one is left alone. Every statement is IF NOT EXISTS, which
 * also makes this safe on files made by earlier builds that used numbered migration files.
 * When the schema has to change, add an `ALTER` step keyed on `user_version` below.
 */

const SCHEMA_VERSION = 1;

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS entities (
    entity_type  TEXT NOT NULL,
    id           TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    search_text  TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    deleted_at   TEXT,
    server_rev   TEXT,
    PRIMARY KEY (entity_type, id)
  );
  CREATE INDEX IF NOT EXISTS idx_entities_user_type ON entities(user_id, entity_type);
  CREATE INDEX IF NOT EXISTS idx_entities_updated ON entities(updated_at);
  CREATE INDEX IF NOT EXISTS idx_entities_active ON entities(entity_type, deleted_at);

  CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
    entity_type,
    entity_id,
    search_text,
    tokenize = 'porter unicode61'
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key        TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

function applySchema(db) {
  const current = db.pragma('user_version', { simple: true });
  if (current >= SCHEMA_VERSION) return;
  db.exec(SCHEMA_SQL);
  db.pragma(`user_version = ${SCHEMA_VERSION}`);
}

module.exports = { applySchema, SCHEMA_VERSION };
