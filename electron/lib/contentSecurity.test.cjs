'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

// protocol.cjs reaches for electron at require time; the guard under test does
// not need any of it.
const load = Module._load;
Module._load = function stubElectron(request, ...rest) {
  if (request === 'electron') {
    return { session: {}, protocol: {}, net: {}, app: {}, BrowserWindow: class {} };
  }
  return load.call(this, request, ...rest);
};

const { isOwnDocument } = require('./contentSecurity.cjs');

test('our own documents get our policy', () => {
  assert.equal(isOwnDocument('veenna-community://app/'), true);
  assert.equal(isOwnDocument('veenna-community://app/assets/index-abc123.js'), true);
  assert.equal(isOwnDocument('file:///Applications/veenna.app/index.html'), true);
  assert.equal(isOwnDocument('http://localhost:3020/'), true);
  assert.equal(isOwnDocument('http://127.0.0.1:3020/src/main.ts'), true);
});

test('embedded third-party pages keep the headers they shipped', () => {
  // The production policy carries `frame-ancestors 'none'`. Stamped onto an
  // embedded page it tells the browser nobody may frame that document, which is
  // what left the Computer pane completely blank in the packaged app. Dev has no
  // frame-ancestors, so it looked fine there.
  assert.equal(isOwnDocument('https://6080-abc123.e2b.app/vnc.html?autoconnect=true'), false);
  assert.equal(isOwnDocument('wss://6080-abc123.e2b.app/websockify'), false);
  assert.equal(isOwnDocument('https://api.veenna.com/api/v1/veenna/workers'), false);
  assert.equal(isOwnDocument('https://accounts.google.com/o/oauth2/auth'), false);
});

test('a hostname that merely starts with localhost is not ours', () => {
  assert.equal(isOwnDocument('https://localhost.evil.com/'), false);
  assert.equal(isOwnDocument('https://127.0.0.1.evil.com/'), false);
  assert.equal(isOwnDocument(''), false);
  assert.equal(isOwnDocument(null), false);
});
