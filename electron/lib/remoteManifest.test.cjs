'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const { checkOnline, verifyEnvelope, compareVersions, canonicalJson } = require('./remoteManifest.cjs');

// The API's own signer is ESM; load it the same way the API does.
async function api() {
  return import('../../api/src/manifest.mjs');
}

function keys() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }),
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

test('canonical form ignores key order and matches the API signer', async () => {
  const { canonicalJson: apiCanonical } = await api();
  const value = { b: [1, { z: 1, a: 2 }], a: 'x' };
  assert.equal(canonicalJson(value), apiCanonical(value));
  assert.equal(canonicalJson({ a: 1, b: 2 }), canonicalJson({ b: 2, a: 1 }));
});

test('an envelope signed by the API verifies; a tampered or unknown-key one does not', async () => {
  const { signManifest } = await api();
  const { publicPem, privatePem } = keys();
  const envelope = signManifest({ version: '1.2.0' }, privatePem, 'k1');
  assert.deepEqual(verifyEnvelope(envelope, { k1: publicPem }), { version: '1.2.0' });
  assert.equal(verifyEnvelope({ ...envelope, payload: { version: '9.9.9' } }, { k1: publicPem }), null);
  assert.equal(verifyEnvelope(envelope, { other: publicPem }), null);
  assert.equal(verifyEnvelope(envelope, { k1: keys().publicPem }), null);
  assert.equal(verifyEnvelope(null, { k1: publicPem }), null);
});

test('versions compare numerically', () => {
  assert.equal(compareVersions('0.10.0', '0.9.0'), 1);
  assert.equal(compareVersions('1.0', '1.0.0'), 0);
  assert.equal(compareVersions('0.1.0', '0.2.0'), -1);
});

test('checkOnline reports a newer version and models the app does not list', async () => {
  const { signManifest } = await api();
  const { publicPem, privatePem } = keys();
  const files = {
    'https://x/v1/latest.json': signManifest({ version: '0.2.0', notes: 'n', pageUrl: 'https://x/d' }, privatePem, 'k1'),
    'https://x/v1/models.json': signManifest(
      { models: [{ id: 'a', label: 'A' }, { id: 'new', label: 'New', sizeLabel: '1 GB' }] },
      privatePem,
      'k1',
    ),
  };
  const result = await checkOnline({
    apiBase: 'https://x/v1',
    fetchText: async (url) => JSON.stringify(files[url]),
    publicKeys: { k1: publicPem },
    currentVersion: '0.1.0',
    knownModelIds: ['a'],
  });
  assert.equal(result.ok, true);
  assert.equal(result.updateAvailable, true);
  assert.equal(result.latestVersion, '0.2.0');
  assert.deepEqual(result.newModels, [{ id: 'new', label: 'New', sizeLabel: '1 GB' }]);
});

test('checkOnline refuses an unverifiable reply and survives an unreachable server', async () => {
  const { signManifest } = await api();
  const { publicPem } = keys();
  const forged = signManifest({ version: '9.0.0' }, keys().privatePem, 'k1');
  const unverified = await checkOnline({
    apiBase: 'https://x/v1',
    fetchText: async () => JSON.stringify(forged),
    publicKeys: { k1: publicPem },
    currentVersion: '0.1.0',
    knownModelIds: [],
  });
  assert.equal(unverified.ok, false);
  assert.equal(unverified.reason, 'unverified');
  const down = await checkOnline({
    apiBase: 'https://x/v1',
    fetchText: async () => {
      throw new Error('offline');
    },
    publicKeys: { k1: publicPem },
    currentVersion: '0.1.0',
    knownModelIds: [],
  });
  assert.equal(down.reason, 'unreachable');
});
