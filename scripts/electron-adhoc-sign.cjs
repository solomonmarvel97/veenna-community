'use strict'

/**
 * electron-builder afterPack hook - gives the macOS bundle a whole, valid
 * signature before it is packed into the dmg/zip.
 *
 * With no signing identity, electron-builder skips signing and the bundle keeps
 * only Electron's linker signature on the main binary: identifier "Electron",
 * no sealed resources. macOS can't validate that, so the Accessibility grant
 * never matches the running app and the "would like to control this computer"
 * prompt comes back on every launch.
 *
 * A Developer ID identity is required for releases that use global macOS
 * input. An ad-hoc signature remains useful for a one-off local build, but
 * macOS cannot carry its Accessibility/Input Monitoring grant to the next
 * rebuild because its code hash changes.
 *
 * A signature is also what the "veenna Safe Storage" Keychain item trusts. An
 * ad-hoc one is a different app on every build, so macOS asks for the login
 * password at launch after each install. A certificate named "veenna Local Signing" in
 * the login keychain (a self-signed Code Signing one is enough for this Mac) is
 * picked up automatically and keeps both the Keychain and hotkey grants.
 *
 * --deep is used only for the first pass, to seal Electron's nested framework
 * tree. The final app pass is deliberately shallow so the app keeps its own
 * entitlements and the key monitor keeps its stable identifier.
 */
const { execFileSync } = require('node:child_process')
const path = require('node:path')

const LOCAL_IDENTITY = 'veenna Local Signing'

function localIdentityInstalled() {
  try {
    const out = execFileSync('security', ['find-identity', '-p', 'codesigning'], {
      encoding: 'utf8',
    })
    return out.includes(`"${LOCAL_IDENTITY}"`)
  } catch {
    return false
  }
}

// Name prefixes electron-builder's auto-discovery accepts. A self-signed
// "veenna Local Signing" certificate is not one of them.
const APPLE_IDENTITY_PREFIXES = ['"Developer ID Application:', '"Apple Development:', '"Mac Developer:', '"Apple Distribution:', '"3rd Party Mac Developer Application:']

function electronBuilderWillSign() {
  if (process.env.CSC_LINK || process.env.CSC_NAME) return true
  if (process.env.CSC_IDENTITY_AUTO_DISCOVERY === 'false') return false
  try {
    const out = execFileSync('security', ['find-identity', '-p', 'codesigning', '-v'], {
      encoding: 'utf8',
    })
    return APPLE_IDENTITY_PREFIXES.some((prefix) => out.includes(prefix))
  } catch {
    return false
  }
}

module.exports = async function adhocSignMacBuild(context) {
  if (process.platform !== 'darwin') return
  if (context.electronPlatformName !== 'darwin') return

  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(context.appOutDir, `${appName}.app`)
  const identity =
    process.env.VEENNA_MAC_SIGN_IDENTITY ||
    process.env.CSC_NAME ||
    (localIdentityInstalled() ? LOCAL_IDENTITY : '-')
  const entitlements = path.join(__dirname, '..', 'electron', 'entitlements.mac.plist')
  const monitorPath = path.join(appPath, 'Contents', 'MacOS', 'veenna-dictation-key-monitor')

  if (identity === '-') {
    console.warn(
      `[sign] Building with an ad-hoc signature. macOS will ask for the login password (Keychain) and forget hotkey permissions after every install. Create a "${LOCAL_IDENTITY}" code-signing certificate, or set VEENNA_MAC_SIGN_IDENTITY (Developer ID) for a release.`,
    )
  }

  // Electron's prebuilt framework tree has to be signed from the leaves up.
  // Do this before the helper/app-specific passes; doing it last would replace
  // both of those identities.
  execFileSync('codesign', ['--force', '--deep', '--sign', identity, appPath], {
    stdio: 'inherit',
  })

  // Give the executable a stable bundle-style identifier. With a real signing
  // certificate, TCC can now associate this helper with future app updates.
  execFileSync(
    'codesign',
    [
      '--force',
      '--sign',
      identity,
      '--identifier',
      'com.veenna.dictation-key-monitor',
      monitorPath,
    ],
    { stdio: 'inherit' },
  )
  console.log(
    `[sign] Signing ${appPath} with ${identity === '-' ? 'an ad-hoc signature' : identity}…`,
  )
  execFileSync(
    'codesign',
    ['--force', '--sign', identity, '--entitlements', entitlements, appPath],
    { stdio: 'inherit' },
  )
  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'inherit' })
}

module.exports.electronBuilderWillSign = electronBuilderWillSign
