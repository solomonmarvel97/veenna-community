#!/usr/bin/env node
/**
 * Run main-process tests on Electron's own Node, not the system one.
 *
 * postinstall (electron-rebuild) compiles better-sqlite3 and uiohook-napi for
 * Electron's ABI - that is what the packaged app loads. Plain `node --test`
 * cannot open those binaries (ERR_DLOPEN_FAILED, NODE_MODULE_VERSION mismatch),
 * so tests run with ELECTRON_RUN_AS_NODE=1 against the same runtime that ships.
 *
 *   node scripts/run-electron-tests.cjs                      # electron/ + scripts/
 *   node scripts/run-electron-tests.cjs electron/lib/terminal # one folder
 *   node scripts/run-electron-tests.cjs electron/db/migrate.test.cjs
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_ROOTS = ['electron', 'scripts'];
const SUFFIX = '.test.cjs';
const SKIP_DIRS = new Set(['node_modules', 'release', 'dist']);

function collect(target, out) {
  const full = path.resolve(ROOT, target);
  const stat = fs.statSync(full);
  if (stat.isFile()) {
    out.push(path.relative(ROOT, full));
    return;
  }
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collect(path.join(full, entry.name), out);
    } else if (entry.name.endsWith(SUFFIX)) {
      out.push(path.relative(ROOT, path.join(full, entry.name)));
    }
  }
}

function main() {
  const targets = process.argv.slice(2);
  const files = [];
  for (const target of targets.length ? targets : DEFAULT_ROOTS) collect(target, files);
  if (!files.length) {
    console.error('run-electron-tests: no *.test.cjs files found');
    process.exit(1);
  }
  files.sort();

  const electron = require('electron');
  const result = spawnSync(electron, ['--test', ...files], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  });
  if (result.error) {
    console.error(`run-electron-tests: ${result.error.message}`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

main();
