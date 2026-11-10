'use strict';

/**
 * electron-builder afterPack hook - runs before signing.
 *
 * Minifies the main process, prunes what the packaged app never loads, flips the Electron
 * fuses and (macOS) seals the bundle with an ad-hoc signature when no identity is available.
 */
const fs = require('fs');
const path = require('path');
const { minifyMainProcess } = require('./lib/minifyMainProcess.cjs');
const { pruneShippedApp } = require('./lib/pruneShippedApp.cjs');
const { Arch } = require('electron-builder');
const adhocSignMacBuild = require('./electron-adhoc-sign.cjs');

// Electron Fuses. Cookie encryption is off: the app stores no cookies or secrets.
// runAsNode stays ON: the whisper and ONNX workers
// both spawn this binary with ELECTRON_RUN_AS_NODE. asar integrity/only-load-from-asar
// stay off because the app ships unpacked (asar: false). Flipped here rather than
// through electron-builder's `electronFuses`, which runs after this hook and would
// undo the ad-hoc signature sealed below.
const ELECTRON_FUSES = {
  runAsNode: true,
  enableNodeOptionsEnvironmentVariable: false,
  enableNodeCliInspectArguments: false,
  enableCookieEncryption: false,
  enableEmbeddedAsarIntegrityValidation: false,
  onlyLoadAppFromAsar: false,
  grantFileProtocolExtraPrivileges: false,
};

module.exports = async function afterPack(context) {
  const { appOutDir, electronPlatformName, packager } = context;

  const resources =
    electronPlatformName === 'darwin'
      ? path.join(appOutDir, `${packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
      : path.join(appOutDir, 'resources');

  // Every platform: strip comments and shorten names in the shipped main-process code.
  if (process.env.VEENNA_SKIP_MINIFY !== '1') {
    const { files, bytesBefore, bytesAfter } = minifyMainProcess(path.join(resources, 'app', 'electron'));
    console.log(`[afterPack] minified ${files} main-process files: ${bytesBefore} -> ${bytesAfter} bytes`);
  }

  // Drop what the packaged app never loads (other platforms' bindings, duplicate WASM,
  // native sources, the Tiny model where veenna-whisper ships). See pruneShippedApp.cjs.
  const pruned = pruneShippedApp(resources, { platform: electronPlatformName, arch: Arch[context.arch] });
  console.log(`[afterPack] pruned ${pruned.removed} unused paths: ${(pruned.bytes / 1048576).toFixed(1)} MB`);

  await packager.addElectronFuses(context, await packager.generateFuseConfig(ELECTRON_FUSES));

  if (electronPlatformName === 'win32') return;

  // Flipping the Electron fuses rewrites the Electron Framework binary, which
  // breaks its linker signature. With signing off, electron-builder never
  // re-signs, and macOS kills the app at launch (Code Signature Invalid). Seal
  // the bundle ourselves; a real identity later re-signs over this. Auto-discovery
  // on with no Apple identity in the keychain (plain `electron:build` on a dev Mac)
  // skips signing just the same, so seal those builds too.
  if (electronPlatformName === 'darwin' && !adhocSignMacBuild.electronBuilderWillSign()) {
    await adhocSignMacBuild(context);
  }
};
