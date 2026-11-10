'use strict';

const path = require('path');
const fs = require('fs');
const { app } = require('electron');

function getLocalStoreRoot() {
  return path.join(app.getPath('userData'), 'local');
}

function getUserLocalDir(userId) {
  const safe = String(userId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);
  if (!safe) return null;
  return path.join(getLocalStoreRoot(), safe);
}

function getContentDbPath(userId) {
  const dir = getUserLocalDir(userId);
  return dir ? path.join(dir, 'content.db') : null;
}

function ensureUserLocalDir(userId) {
  const dir = getUserLocalDir(userId);
  if (!dir) return null;
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'models'), { recursive: true });
  return dir;
}

module.exports = {
  getLocalStoreRoot,
  getUserLocalDir,
  getContentDbPath,
  ensureUserLocalDir,
};
