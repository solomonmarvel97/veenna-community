import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { generateKeyPairSync } from 'node:crypto'
import { createHandler } from '../src/server.mjs'
import { signManifest, verifyManifest, canonicalJson } from '../src/manifest.mjs'

function keys() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  return {
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }),
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  }
}

async function serve(distDir) {
  const server = createServer(createHandler(distDir))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() }
}

test('signing round-trips and a changed payload fails', () => {
  const { publicPem, privatePem } = keys()
  const envelope = signManifest({ b: 2, a: 1 }, privatePem, 'k')
  assert.equal(verifyManifest(envelope, publicPem), true)
  assert.equal(verifyManifest({ ...envelope, payload: { a: 1, b: 3 } }, publicPem), false)
  assert.equal(canonicalJson({ b: 2, a: 1 }), '{"a":1,"b":2}')
})

test('serves the signed files, a health check, and nothing that writes', async () => {
  const { publicPem, privatePem } = keys()
  const dir = mkdtempSync(path.join(tmpdir(), 'vc-api-'))
  const latest = signManifest({ version: '1.0.0' }, privatePem, 'k')
  writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(latest))
  writeFileSync(path.join(dir, 'models.json'), JSON.stringify(signManifest({ models: [] }, privatePem, 'k')))
  const { base, close } = await serve(dir)
  try {
    const health = await fetch(`${base}/v1/health`)
    assert.equal(health.status, 204)

    const res = await fetch(`${base}/v1/latest.json`)
    assert.equal(res.status, 200)
    assert.equal(verifyManifest(await res.json(), publicPem), true)

    assert.equal((await fetch(`${base}/v1/models.json`, { method: 'HEAD' })).status, 200)
    assert.equal((await fetch(`${base}/v1/nope`)).status, 404)
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const refused = await fetch(`${base}/v1/latest.json`, { method, body: method === 'DELETE' ? undefined : 'dictation text' })
      assert.equal(refused.status, 405, method)
    }
  } finally {
    close()
  }
})

test('sets no cookies and no cross-site headers', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'vc-api-'))
  const { privatePem } = keys()
  writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(signManifest({ v: 1 }, privatePem, 'k')))
  const { base, close } = await serve(dir)
  try {
    const res = await fetch(`${base}/v1/latest.json`)
    assert.equal(res.headers.get('set-cookie'), null)
  } finally {
    close()
  }
})
