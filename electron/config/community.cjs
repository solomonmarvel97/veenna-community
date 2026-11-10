'use strict';

/**
 * Where the app reads its signed model catalog and latest-version manifest.
 * Reading only (GET); the app never sends anything to it. Self-hosters and mirrors set
 * VEENNA_COMMUNITY_API (a base address ending in /v1). The default is a placeholder until the
 * production host is chosen (owner decision).
 */
const DEFAULT_API_BASE_URL = 'https://community.veenna.com/v1';

function getApiBaseUrl() {
  const override = String(process.env.VEENNA_COMMUNITY_API || '').trim().replace(/\/$/, '');
  return override || DEFAULT_API_BASE_URL;
}

function getApiHost() {
  try {
    return new URL(getApiBaseUrl()).hostname;
  } catch {
    return '';
  }
}

/**
 * Public keys that may sign the manifests, by key id. The development key below belongs to the
 * repository's test setup; the production key is created and held by the owner and replaces it
 * before release (see api/README.md).
 */
const MANIFEST_PUBLIC_KEYS = {
  dev: `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAxApaePeS7pXxQLMtTsuCBlPgbCa+LYu5SWz2hrCMB/E=
-----END PUBLIC KEY-----
`,
};

module.exports = { DEFAULT_API_BASE_URL, getApiBaseUrl, getApiHost, MANIFEST_PUBLIC_KEYS };
