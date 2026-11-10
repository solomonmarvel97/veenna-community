'use strict';

const path = require('path');

/** Native modules and worker threads must load from app.asar.unpacked, not app.asar. */
function resolvePackagedPath(filePath) {
  if (filePath.includes(`${path.sep}app.asar${path.sep}`)) {
    return filePath.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
  }
  return filePath;
}

module.exports = { resolvePackagedPath };
