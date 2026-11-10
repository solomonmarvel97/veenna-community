'use strict';

/**
 * Dictation must never leave the device. This test reads every source file and lists each web
 * address written in it; every host has to be one the app is allowed to talk to (see
 * communityLockdown.cjs, which refuses everything else at run time) or one that is only ever
 * opened in the person's own browser or is a standard (XML, W3C) identifier.
 * A new address fails the test until someone decides, on purpose, that it belongs here.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getApiHost } = require('../config/community.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const SCAN_DIRS = ['src', 'electron'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.vue', '.cjs', '.js', '.mjs', '.json', '.html']);
const SKIP_DIRS = new Set(['node_modules', 'native', 'assets']);

/** Hosts the app may reach from its own code (read-only; the lockdown enforces the methods). */
const NETWORK_HOSTS = new Set(['huggingface.co', 'hf.co', getApiHost()]);

/** Hosts that appear in code but are only opened in the system browser, or are inert identifiers. */
const NON_NETWORK_HOSTS = new Set([
  'veenna.com',
  'www.veenna.com',
  'github.com',
  'localhost',
  '127.0.0.1',
  'www.w3.org',
  'www.apple.com',
  'support.apple.com',
  'developer.apple.com',
  'example.com',
  'docs.google.com',
  // Only named in the wallpaper address tidy-up. The run-time lockdown refuses it, so a wallpaper
  // from there cannot load; wallpapers come from the person's own files.
  'images.pexels.com',
]);

const HOST_END = new Set(['/', '"', "'", '`', ' ', ')', ']', '>', '<', '\\', ',', ';', '?', '#', '\n', '\r', '*']);

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), out);
    } else if (
      SOURCE_EXTENSIONS.has(path.extname(entry.name)) &&
      !entry.name.includes('.test.') &&
      !entry.name.includes('.stories.')
    ) {
      out.push(path.join(dir, entry.name));
    }
  }
}

/** Every host written after `http://`, `https://`, `ws://` or `wss://` in the text. */
function hostsIn(text) {
  const found = [];
  for (const scheme of ['https://', 'http://', 'wss://', 'ws://']) {
    let at = text.indexOf(scheme);
    while (at !== -1) {
      let end = at + scheme.length;
      while (end < text.length && !HOST_END.has(text[end])) end += 1;
      let host = text.slice(at + scheme.length, end);
      const colon = host.indexOf(':');
      if (colon !== -1) host = host.slice(0, colon);
      if (host && !host.includes('$') && !host.includes('{')) found.push(host.toLowerCase());
      at = text.indexOf(scheme, at + scheme.length);
    }
  }
  return found;
}

test('code only names hosts the app is allowed to use', () => {
  const files = [];
  for (const dir of SCAN_DIRS) walk(path.join(ROOT, dir), files);
  assert.ok(files.length > 100, 'the scan should find the app source');

  const unknown = new Map();
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const host of hostsIn(text)) {
      const known = NETWORK_HOSTS.has(host) || NON_NETWORK_HOSTS.has(host) || host.endsWith('.huggingface.co');
      if (!known) unknown.set(host, path.relative(ROOT, file));
    }
  }
  assert.deepEqual(
    [...unknown.entries()],
    [],
    'These hosts are not on the allowed list. Dictation must not reach them.',
  );
});

test('no code path sends data to a host built at run time without the lockdown', () => {
  // The run-time lockdown is the backstop: it must be wired in before any window loads.
  const lifecycle = fs.readFileSync(path.join(ROOT, 'electron', 'app', 'lifecycle.cjs'), 'utf8');
  assert.ok(lifecycle.includes('communityLockdown'), 'lifecycle must install the network lockdown');
});
