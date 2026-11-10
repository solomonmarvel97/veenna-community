'use strict';

/**
 * electron-builder afterSign hook - notarizes macOS builds when Apple credentials are set.
 * Skips silently for unsigned/local builds (no APPLE_ID).
 *
 * Required env (CI or local release):
 *   APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID
 * Optional:
 *   CSC_NAME - signing identity (electron-builder also reads CSC_LINK / CSC_KEY_PASSWORD)
 */
module.exports = async function notarizeMacBuild(context) {
  if (process.platform !== 'darwin') return;

  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.log('[notarize] Skipping - set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID to notarize.');
    return;
  }

  if (process.env.CSC_IDENTITY_AUTO_DISCOVERY === 'false') {
    console.log('[notarize] Skipping - CSC_IDENTITY_AUTO_DISCOVERY=false (unsigned build).');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`[notarize] Notarizing ${appPath}…`);

  const { notarize } = require('@electron/notarize');
  await notarize({
    appPath,
    appleId,
    appleIdPassword,
    teamId,
  });

  console.log('[notarize] Done.');
};
