'use strict';

const crypto = require('crypto');

// Dictations and the Todo lists and tasks. Nothing else is stored.
const ENTITY_TYPES = new Set(['voice_capture', 'todo_list', 'todo_item']);

function hashSearchText(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex');
}

function chunkId(entityType, entityId, chunkIndex = 0) {
  return `${entityType}:${entityId}:${chunkIndex}`;
}

function validateEntityType(type) {
  const value = String(type || '').trim();
  if (!ENTITY_TYPES.has(value)) {
    throw new Error(`unsupported entity type: ${value}`);
  }
  return value;
}

module.exports = {
  ENTITY_TYPES,
  hashSearchText,
  chunkId,
  validateEntityType,
};
