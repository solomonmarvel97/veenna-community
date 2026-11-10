'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// The module only needs `electron` for the switches and session, which these tests do not call.
const realLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'electron') return { app: {}, session: {} };
  return realLoad.call(this, request, ...rest);
};
const { isAllowedRequest } = require('./communityLockdown.cjs');
Module._load = realLoad;

test('the app page and local files are allowed', () => {
  assert.equal(isAllowedRequest('veenna-community://app/index.html'), true);
  assert.equal(isAllowedRequest('file:///x/index.html'), true);
  assert.equal(isAllowedRequest('blob:veenna-community://app/abc'), true);
  assert.equal(isAllowedRequest('data:text/plain,hi'), true);
});

test('the model host is readable but never writable', () => {
  assert.equal(isAllowedRequest('https://huggingface.co/api/models/ggml/whisper-base-q5_1'), true);
  assert.equal(isAllowedRequest('https://cdn-lfs.huggingface.co/repos/a/b', { method: 'GET' }), true);
  assert.equal(isAllowedRequest('https://huggingface.co/x', { method: 'HEAD' }), true);
  assert.equal(isAllowedRequest('https://huggingface.co/x', { method: 'POST' }), false);
  assert.equal(isAllowedRequest('https://huggingface.co/x', { method: 'PUT' }), false);
  assert.equal(isAllowedRequest('http://huggingface.co/x'), false);
  assert.equal(isAllowedRequest('https://huggingface.co.evil.com/x'), false);
  assert.equal(isAllowedRequest('https://nothuggingface.co/x'), false);
});

test('every remote address is refused', () => {
  assert.equal(isAllowedRequest('https://api.veenna.com/api/v1/x'), false);
  assert.equal(isAllowedRequest('http://example.com'), false);
  assert.equal(isAllowedRequest('wss://example.com/socket'), false);
  assert.equal(isAllowedRequest('not a url'), false);
});

test('loopback is refused unless the dev server is allowed', () => {
  assert.equal(isAllowedRequest('http://localhost:3021/x'), false);
  assert.equal(isAllowedRequest('http://localhost:3021/x', { allowLoopback: true }), true);
  assert.equal(isAllowedRequest('https://localhost.evil.com/x', { allowLoopback: true }), false);
});


test('the Community API host is readable but never writable', () => {
  const { getApiHost } = require('../config/community.cjs');
  const host = getApiHost();
  assert.ok(host);
  assert.equal(isAllowedRequest(`https://${host}/v1/latest.json`, { method: 'GET' }), true);
  assert.equal(isAllowedRequest(`https://${host}/v1/latest.json`, { method: 'POST' }), false);
  assert.equal(isAllowedRequest(`https://evil-${host}/v1/latest.json`, { method: 'GET' }), false);
});
