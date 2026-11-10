'use strict';

/**
 * Minify the Electron main-process sources inside a packed app.
 *
 * Runs from the afterPack hook, on the copy electron-builder staged, never on
 * the repo. It transforms each file in place and does not bundle, so file
 * paths and the require() graph stay exactly as they were. That is what keeps
 * the worker threads, forked children, `__dirname` lookups and ESM imports
 * (@xenova/transformers) resolving the way they do today.
 *
 * keepNames stays on: some code may read function/class names, and the cost is
 * a few bytes. Comments are dropped; that is most of the readability win.
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const SOURCE_EXTENSIONS = new Set(['.cjs', '.js', '.mjs']);
const SKIPPED_DIRECTORIES = new Set(['node_modules']);

function isTestFile(name) {
  return name.includes('.test.');
}

function collectSources(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) collectSources(full, found);
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name)) && !isTestFile(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

/**
 * @param {string} electronDir the packed `<app>/electron` folder
 * @returns {{ files: number, bytesBefore: number, bytesAfter: number }}
 */
function minifyMainProcess(electronDir) {
  if (!fs.existsSync(electronDir)) {
    throw new Error(`[minify] electron folder is missing from the bundle: ${electronDir}`);
  }
  let bytesBefore = 0;
  let bytesAfter = 0;
  const sources = collectSources(electronDir);
  for (const file of sources) {
    const original = fs.readFileSync(file, 'utf8');
    let result;
    try {
      result = esbuild.transformSync(original, {
        loader: 'js',
        minify: true,
        keepNames: true,
        legalComments: 'none',
        target: 'node20',
        sourcefile: path.basename(file),
      });
    } catch (error) {
      throw new Error(`[minify] ${file}: ${error.message}`);
    }
    // Keep a shebang if a file has one; esbuild preserves it, but the exec bit is ours to keep.
    const mode = fs.statSync(file).mode;
    fs.writeFileSync(file, result.code, { mode });
    bytesBefore += Buffer.byteLength(original);
    bytesAfter += Buffer.byteLength(result.code);
  }
  return { files: sources.length, bytesBefore, bytesAfter };
}

module.exports = { minifyMainProcess, collectSources };
