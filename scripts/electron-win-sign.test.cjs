'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const { sign, signCommand, missingSettings, isEngineBinary, brandCommand, pfxFile } = require('./electron-win-sign.cjs')

const AZURE = {
  VEENNA_WIN_SIGN: 'azure',
  AZURE_TENANT_ID: 't',
  AZURE_CLIENT_ID: 'c',
  AZURE_CLIENT_SECRET: 's',
  VEENNA_AZURE_SIGN_ENDPOINT: 'https://eus.codesigning.azure.net',
  VEENNA_AZURE_SIGN_ACCOUNT: 'veenna',
  VEENNA_AZURE_SIGN_PROFILE: 'public',
}

function recorder() {
  const runs = []
  const logs = []
  return { runs, logs, exec: (cmd) => runs.push(cmd), log: (line) => logs.push(line) }
}

test('nothing set: a dev build is left unsigned and goes on', async () => {
  const r = recorder()
  await sign({ path: 'C:\\out\\veenna.exe', hash: 'sha256' }, null, { env: {}, exec: r.exec, log: r.log })
  assert.equal(r.runs.length, 0)
  assert.ok(r.logs[0].includes('not signed'))
})

test('a release that must be signed stops when signing is not set up', async () => {
  const r = recorder()
  await assert.rejects(sign({ path: 'veenna.exe', hash: 'sha256' }, null, { env: { VEENNA_WIN_SIGN_REQUIRED: '1' }, exec: r.exec, log: r.log }), (err) => err.message.includes('must be signed'))
  await assert.rejects(
    sign({ path: 'veenna.exe', hash: 'sha256' }, null, { env: { VEENNA_WIN_SIGN: 'azure', VEENNA_WIN_SIGN_REQUIRED: '1' }, exec: r.exec, log: r.log }),
    (err) => err.message.includes('missing AZURE_TENANT_ID'),
  )
})

test('only SHA-256 signatures are made', async () => {
  const r = recorder()
  await sign({ path: 'veenna.exe', hash: 'sha1' }, null, { env: AZURE, exec: r.exec, log: r.log })
  assert.equal(r.runs.length, 0)
})

test('Azure Trusted Signing goes through Invoke-TrustedSigning with SHA-256 and a timestamp', async () => {
  const r = recorder()
  await sign({ path: "C:\\out\\it's veenna.exe", hash: 'sha256' }, null, { env: AZURE, exec: r.exec, log: r.log })
  assert.equal(r.runs.length, 1)
  const { command, args } = r.runs[0]
  assert.equal(command, 'pwsh')
  const script = args[args.length - 1]
  assert.ok(script.includes('Invoke-TrustedSigning'))
  assert.ok(script.includes("-Endpoint 'https://eus.codesigning.azure.net'"))
  assert.ok(script.includes('-FileDigest SHA256'))
  assert.ok(script.includes("-Files 'C:\\out\\it''s veenna.exe'"), 'quotes in the path are escaped')
  assert.ok(r.logs[0].includes('signed with azure'))
})

test('signtool signs with a store certificate by thumbprint, then verifies', async () => {
  const r = recorder()
  await sign({ path: 'veenna.exe', hash: 'sha256' }, null, {
    env: { VEENNA_WIN_SIGN: 'signtool', VEENNA_WIN_CERT_SHA1: 'ABC123' },
    exec: r.exec,
    log: r.log,
  })
  assert.equal(r.runs.length, 2)
  assert.deepEqual(r.runs[0].args, ['sign', '/fd', 'sha256', '/tr', 'http://timestamp.digicert.com', '/td', 'sha256', '/sha1', 'ABC123', 'veenna.exe'])
  assert.deepEqual(r.runs[1].args, ['verify', '/pa', 'veenna.exe'])
})

test('signtool can use a .pfx and its password instead', () => {
  const { args } = signCommand('signtool', 'veenna.exe', { CSC_LINK: 'cert.pfx', CSC_KEY_PASSWORD: 'pw', VEENNA_WIN_SIGNTOOL: 'C:\\sdk\\signtool.exe' })
  assert.deepEqual(args.slice(7), ['/f', path.resolve('cert.pfx'), '/p', 'pw', 'veenna.exe'])
})

test('names exactly what is missing', () => {
  assert.deepEqual(missingSettings('signtool', {}), ['VEENNA_WIN_CERT_SHA1 or CSC_LINK + CSC_KEY_PASSWORD'])
  assert.deepEqual(missingSettings('azure', { ...AZURE, VEENNA_AZURE_SIGN_PROFILE: '' }), ['VEENNA_AZURE_SIGN_PROFILE'])
  assert.ok(missingSettings('gpg', {})[0].includes('unknown provider'))
})

test('the engine gets Veenna\'s file properties, then our signature', async () => {
  const engine = path.join('out', 'win-unpacked', 'resources', 'engine', 'bin', 'veenna-engine.exe')
  assert.equal(isEngineBinary(engine), true)
  assert.equal(isEngineBinary(path.join('out', 'win-unpacked', 'veenna.exe')), false)
  const r = recorder()
  await sign({ path: engine, hash: 'sha256' }, null, { env: AZURE, exec: r.exec, log: r.log, platform: 'win32' })
  assert.equal(r.runs.length, 2)
  assert.deepEqual(r.runs[0], brandCommand(engine, AZURE))
  const strings = r.runs[0].args.join(' ')
  assert.ok(strings.includes('CompanyName Veenna'))
  assert.ok(strings.includes('ProductName Veenna Engine'))
  assert.equal(r.runs[1].command, 'pwsh')
})

test('a release refuses to ship the engine with the file properties it was built with', async () => {
  const engine = path.join('out', 'win-unpacked', 'resources', 'engine', 'bin', 'veenna-engine.exe')
  const r = recorder()
  await assert.rejects(sign({ path: engine, hash: 'sha256' }, null, { env: { ...AZURE, VEENNA_WIN_SIGN_REQUIRED: '1' }, exec: r.exec, log: r.log, platform: 'darwin' }))
  await sign({ path: engine, hash: 'sha256' }, null, { env: AZURE, exec: r.exec, log: r.log, platform: 'darwin' })
  assert.equal(r.runs.length, 1, 'signed, not branded, off Windows outside a release')
})

test('CSC_LINK may be a path or the certificate itself in base64', () => {
  const written = []
  const onDisk = new Set(['C:\\certs\\veenna.pfx'])
  const deps = { exists: (f) => onDisk.has(f), write: (f, data, opts) => written.push([f, data, opts]), tmpdir: 'T' }
  assert.equal(pfxFile('C:\\certs\\veenna.pfx', deps), path.resolve('C:\\certs\\veenna.pfx'))
  const file = pfxFile(Buffer.from('pfx-bytes').toString('base64'), deps)
  assert.equal(file, path.join('T', `veenna-win-sign-${process.pid}.pfx`))
  assert.equal(written[0][1].toString(), 'pfx-bytes')
  assert.equal(written[0][2].mode, 0o600)
})
