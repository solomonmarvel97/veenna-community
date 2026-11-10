'use strict';

/**
 * Which edition this build is.
 *
 * "community" is the free, dictation-only app: no sign-in, no cloud, nothing
 * leaves the machine (see lib/communityLockdown.cjs). Packaged builds carry the
 * edition in package.json (electron-builder.community.yml sets `extraMetadata`);
 * dev runs set VEENNA_EDITION=community.
 */
let packageEdition = '';
try {
  packageEdition = String(require('../../package.json').veennaEdition || '');
} catch {
  packageEdition = '';
}

const EDITION = process.env.VEENNA_EDITION || packageEdition || 'commercial';
const isCommunity = true; // this app is the community edition

/** Where "Go Pro" sends people; opened in their own browser, never fetched by the app. */
const GO_PRO_URL = 'https://veenna.com/download?from=community';

module.exports = { EDITION, isCommunity, GO_PRO_URL };
