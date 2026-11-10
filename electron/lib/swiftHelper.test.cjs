'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { helperNeedsRebuild, existingHelper, ensureSwiftHelper } = require('./swiftHelper.cjs');

test('helperNeedsRebuild is false for packaged apps', () => {
  assert.equal(helperNeedsRebuild('/missing', '/missing.swift', true), false);
});

test('helperNeedsRebuild is true when the binary is missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'veenna-swift-'));
  const src = path.join(dir, 'helper.swift');
  fs.writeFileSync(src, '// test');
  assert.equal(helperNeedsRebuild(path.join(dir, 'helper'), src, false), true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('helperNeedsRebuild is false when the binary is newer than source', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'veenna-swift-'));
  const src = path.join(dir, 'helper.swift');
  const bin = path.join(dir, 'helper');
  fs.writeFileSync(src, '// test');
  fs.writeFileSync(bin, 'ok');
  const past = new Date(Date.now() - 60_000);
  fs.utimesSync(src, past, past);
  assert.equal(helperNeedsRebuild(bin, src, false), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('ensureSwiftHelper returns the existing binary without compiling when fresh', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'veenna-swift-'));
  const src = path.join(dir, 'helper.swift');
  const bin = path.join(dir, 'helper');
  fs.writeFileSync(src, '// test');
  fs.writeFileSync(bin, 'ok');
  const past = new Date(Date.now() - 60_000);
  fs.utimesSync(src, past, past);

  const result = ensureSwiftHelper(bin, src, ['-O', '-o', bin, src], { isPackaged: false });
  assert.equal(result, bin);
  assert.equal(existingHelper(bin), bin);
  fs.rmSync(dir, { recursive: true, force: true });
});
