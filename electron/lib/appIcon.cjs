'use strict';

const path = require('path');
const fs = require('fs');

function resolveAppIconPath() {
  const candidates = [
    path.join(__dirname, '../../build/icon.png'),
    path.join(__dirname, '../../public/logo.png'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

module.exports = { resolveAppIconPath };
