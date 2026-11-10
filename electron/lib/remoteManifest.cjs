'use strict';

/**
 * Reads the Community API's two signed files and checks them. Pure logic: the caller passes in
 * a `fetchText(url)` that does a GET, so this file needs neither Electron nor the network to be tested.
 * A manifest whose signature does not verify under a known key is treated as if it were not there.
 */
const { createPublicKey, verify } = require('crypto');

/** Same canonical form as api/src/manifest.mjs: keys sorted at every depth. */
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function verifyEnvelope(envelope, publicKeys) {
  try {
    if (!envelope || typeof envelope.signature !== 'string' || !envelope.payload) return null;
    const pem = publicKeys[envelope.keyId];
    if (!pem) return null;
    const ok = verify(
      null,
      Buffer.from(canonicalJson(envelope.payload)),
      createPublicKey(pem),
      Buffer.from(envelope.signature, 'base64'),
    );
    return ok ? envelope.payload : null;
  } catch {
    return null;
  }
}

/** Compares dotted numeric versions: 1 when a is newer than b, -1 when older, 0 when equal. */
function compareVersions(a, b) {
  const left = String(a).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const right = String(b).split('.').map((part) => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * @param {{ apiBase: string, fetchText: (url: string) => Promise<string>, publicKeys: Record<string,string>,
 *           currentVersion: string, knownModelIds: string[] }} options
 */
async function checkOnline({ apiBase, fetchText, publicKeys, currentVersion, knownModelIds }) {
  let latest = null;
  let models = null;
  try {
    latest = verifyEnvelope(JSON.parse(await fetchText(`${apiBase}/latest.json`)), publicKeys);
    models = verifyEnvelope(JSON.parse(await fetchText(`${apiBase}/models.json`)), publicKeys);
  } catch {
    return { ok: false, reason: 'unreachable', message: 'Could not reach the update server.' };
  }
  if (!latest || !models) {
    return { ok: false, reason: 'unverified', message: 'The update server answered, but its reply could not be verified.' };
  }
  const known = new Set(knownModelIds);
  const newModels = (Array.isArray(models.models) ? models.models : [])
    .filter((model) => model && typeof model.id === 'string' && !known.has(model.id))
    .map((model) => ({ id: model.id, label: String(model.label || model.id), sizeLabel: String(model.sizeLabel || '') }));
  return {
    ok: true,
    currentVersion,
    latestVersion: String(latest.version),
    updateAvailable: compareVersions(latest.version, currentVersion) > 0,
    notes: typeof latest.notes === 'string' ? latest.notes : '',
    pageUrl: typeof latest.pageUrl === 'string' ? latest.pageUrl : '',
    newModels,
  };
}

module.exports = { canonicalJson, verifyEnvelope, compareVersions, checkOnline };
