'use strict'

/**
 * Authenticode signing for the Windows build, called by electron-builder for
 * every file it signs (win.signtoolOptions.sign in electron-builder.yml).
 *
 * Without a signature Windows SmartScreen warns everyone who installs Veenna.
 * Two ways to sign, picked by VEENNA_WIN_SIGN:
 *
 *   azure     Azure Trusted Signing (Microsoft-held certificate, cheapest).
 *             Needs the TrustedSigning PowerShell module and:
 *               AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
 *               VEENNA_AZURE_SIGN_ENDPOINT   e.g. https://eus.codesigning.azure.net
 *               VEENNA_AZURE_SIGN_ACCOUNT    the code signing account name
 *               VEENNA_AZURE_SIGN_PROFILE    the certificate profile name
 *
 *   signtool  An OV/EV certificate through Microsoft's signtool. Since 2023 these
 *             keys live on hardware or a cloud HSM (DigiCert KeyLocker, SSL.com
 *             eSigner, ...), whose client puts the certificate in the Windows store:
 *               VEENNA_WIN_CERT_SHA1         the certificate's thumbprint, or
 *               CSC_LINK + CSC_KEY_PASSWORD  a .pfx (a path, or the file base64-encoded,
 *                                            as CI secrets usually hold it) and its password
 *               VEENNA_WIN_SIGNTOOL          optional path to signtool.exe
 *               VEENNA_WIN_TIMESTAMP_URL     optional (default DigiCert's)
 *
 * Unset, nothing is signed and the build goes on, so local and dry-run builds
 * keep working. A release build sets VEENNA_WIN_SIGN_REQUIRED=1, and then a
 * missing or failed signature stops the build: an unsigned release never ships.
 *
 * Only SHA-256 signatures are made (signingHashAlgorithms in the yml).
 */

const { spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const DEFAULT_TIMESTAMP_URL = 'http://timestamp.digicert.com'
const AZURE_TIMESTAMP_URL = 'http://timestamp.acs.microsoft.com'

const required = (env) => env.VEENNA_WIN_SIGN_REQUIRED === '1' || env.VEENNA_WIN_SIGN_REQUIRED === 'true'

/** The names of the settings a provider needs that are missing from `env`. */
function missingSettings(provider, env) {
  const need = {
    azure: ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'VEENNA_AZURE_SIGN_ENDPOINT', 'VEENNA_AZURE_SIGN_ACCOUNT', 'VEENNA_AZURE_SIGN_PROFILE'],
    signtool: [],
  }[provider]
  if (!need) return [`VEENNA_WIN_SIGN (unknown provider "${provider}"; use azure or signtool)`]
  const missing = need.filter((name) => !String(env[name] || '').trim())
  if (provider === 'signtool' && !env.VEENNA_WIN_CERT_SHA1 && !(env.CSC_LINK && env.CSC_KEY_PASSWORD)) {
    missing.push('VEENNA_WIN_CERT_SHA1 or CSC_LINK + CSC_KEY_PASSWORD')
  }
  return missing
}

/** The Veenna Engine binary (resources/engine/bin/veenna-engine.exe). */
function isEngineBinary(file) {
  const parts = path.normalize(String(file)).split(path.sep).map((part) => part.toLowerCase())
  const at = parts.indexOf('resources')
  return at >= 0 && parts[at + 1] === 'engine' && parts[parts.length - 1] === 'veenna-engine.exe'
}

/** What the engine's file properties say in Windows, in place of the ones it was built with. */
const ENGINE_VERSION_STRINGS = Object.freeze({
  CompanyName: 'Veenna',
  ProductName: 'Veenna Engine',
  FileDescription: 'Veenna Engine',
  InternalName: 'veenna-engine',
  OriginalFilename: 'veenna-engine.exe',
  LegalCopyright: 'Veenna. Includes open-source software; see NOTICES.txt.',
})

/** The rcedit command that gives the engine Veenna's file properties. */
function brandCommand(file, env) {
  const rcedit = env.VEENNA_WIN_RCEDIT || path.join(__dirname, '..', 'node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe')
  const args = [file]
  for (const [name, value] of Object.entries(ENGINE_VERSION_STRINGS)) args.push('--set-version-string', name, value)
  return { command: rcedit, args }
}

/**
 * The .pfx on disk: CSC_LINK as a path, or written once (owner-only) from the
 * base64 a CI secret holds.
 */
function pfxFile(link, { exists = fs.existsSync, write = fs.writeFileSync, tmpdir = os.tmpdir() } = {}) {
  const value = String(link)
  const asPath = value.startsWith('file://') ? value.slice('file://'.length) : value
  if (exists(asPath)) return path.resolve(asPath)
  const file = path.join(tmpdir, `veenna-win-sign-${process.pid}.pfx`)
  if (!exists(file)) write(file, Buffer.from(value, 'base64'), { mode: 0o600 })
  return file
}

/** PowerShell single-quoted literal. */
const psQuote = (value) => `'${String(value).split("'").join("''")}'`

/**
 * The command that signs `file` with `provider`.
 * @returns {{ command: string, args: string[], verify: { command: string, args: string[] } | null }}
 */
function signCommand(provider, file, env) {
  if (provider === 'azure') {
    const script = [
      'Invoke-TrustedSigning',
      `-Endpoint ${psQuote(env.VEENNA_AZURE_SIGN_ENDPOINT)}`,
      `-CodeSigningAccountName ${psQuote(env.VEENNA_AZURE_SIGN_ACCOUNT)}`,
      `-CertificateProfileName ${psQuote(env.VEENNA_AZURE_SIGN_PROFILE)}`,
      '-FileDigest SHA256',
      `-TimestampRfc3161 ${psQuote(AZURE_TIMESTAMP_URL)}`,
      '-TimestampDigest SHA256',
      `-Files ${psQuote(file)}`,
    ].join(' ')
    return { command: 'pwsh', args: ['-NoProfile', '-NonInteractive', '-Command', `$ErrorActionPreference='Stop'; ${script}`], verify: null }
  }
  const signtool = env.VEENNA_WIN_SIGNTOOL || 'signtool.exe'
  const certificate = env.VEENNA_WIN_CERT_SHA1
    ? ['/sha1', env.VEENNA_WIN_CERT_SHA1]
    : ['/f', env.pfx || path.resolve(env.CSC_LINK), '/p', env.CSC_KEY_PASSWORD]
  return {
    command: signtool,
    args: ['sign', '/fd', 'sha256', '/tr', env.VEENNA_WIN_TIMESTAMP_URL || DEFAULT_TIMESTAMP_URL, '/td', 'sha256', ...certificate, file],
    verify: { command: signtool, args: ['verify', '/pa', file] },
  }
}

function run({ command, args }, label) {
  // Arguments may carry a password: never echo them.
  const result = spawnSync(command, args, { stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true })
  if (result.error) throw new Error(`[win-sign] ${label}: could not run ${path.basename(command)} (${result.error.code || result.error.message})`)
  if (result.status !== 0) throw new Error(`[win-sign] ${label}: ${path.basename(command)} exited ${result.status}`)
}

/**
 * Sign one file. electron-builder passes { path, hash, isNest, ... }.
 * @param {{ path: string, hash?: string }} configuration
 */
async function sign(configuration, _packager, { env = process.env, exec = run, log = console.log, platform = process.platform } = {}) {
  const file = configuration.path
  const name = path.basename(file)
  if (configuration.hash && configuration.hash !== 'sha256') return
  // The engine gets Veenna's file properties before it is signed, so ours is the
  // signature on what it then says. Its upstream signature does not survive the edit.
  if (isEngineBinary(file)) {
    if (platform === 'win32' || env.VEENNA_WIN_RCEDIT) exec(brandCommand(file, env), name)
    else if (required(env)) throw new Error(`[win-sign] ${name}: the engine's file properties can only be set on Windows (or with VEENNA_WIN_RCEDIT).`)
    else log(`[win-sign] ${name}: file properties left as built (not on Windows)`)
  }
  const provider = String(env.VEENNA_WIN_SIGN || '').trim()
  if (!provider) {
    if (required(env)) throw new Error(`[win-sign] ${name}: this release must be signed but VEENNA_WIN_SIGN is not set (azure or signtool).`)
    log(`[win-sign] ${name}: not signed (VEENNA_WIN_SIGN not set)`)
    return
  }
  const missing = missingSettings(provider, env)
  if (missing.length) {
    const message = `[win-sign] ${name}: cannot sign with ${provider}, missing ${missing.join(', ')}`
    if (required(env)) throw new Error(message)
    log(`${message} - left unsigned`)
    return
  }
  const settings = provider === 'signtool' && !env.VEENNA_WIN_CERT_SHA1 ? { ...env, pfx: pfxFile(env.CSC_LINK) } : env
  const { command, args, verify } = signCommand(provider, file, settings)
  exec({ command, args }, `sign ${name}`)
  if (verify) exec(verify, `verify ${name}`)
  log(`[win-sign] ${name}: signed with ${provider}`)
}

module.exports = sign
module.exports.default = sign
module.exports.sign = sign
module.exports.signCommand = signCommand
module.exports.missingSettings = missingSettings
module.exports.isEngineBinary = isEngineBinary
module.exports.brandCommand = brandCommand
module.exports.ENGINE_VERSION_STRINGS = ENGINE_VERSION_STRINGS
module.exports.pfxFile = pfxFile
