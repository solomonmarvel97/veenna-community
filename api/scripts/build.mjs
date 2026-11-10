// Builds the two signed files the API serves into dist/v1/.
//   models.json : the speech-model catalog, taken from the app's own catalog file
//   latest.json : the newest version and where to get it, from data/release.json
// Usage: bun scripts/build.mjs [--key .keys/dev.private.pem] [--key-id dev]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { signManifest } from '../src/manifest.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const at = args.indexOf(name)
  return at === -1 ? fallback : args[at + 1]
}
const keyId = flag('--key-id', 'dev')
const keyPath = path.resolve(root, flag('--key', `.keys/${keyId}.private.pem`))
if (!existsSync(keyPath)) {
  console.error(`No signing key at ${keyPath}. Run: bun scripts/gen-key.mjs ${keyId}`)
  process.exit(1)
}
const privateKeyPem = readFileSync(keyPath, 'utf8')

const catalogPath = path.resolve(root, flag('--catalog', '../src/lib/voice/whisper-model-catalog.json'))
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
const release = JSON.parse(readFileSync(path.join(root, 'data', 'release.json'), 'utf8'))
const issuedAt = new Date().toISOString()

const models = catalog.map((entry) => ({
  id: entry.id,
  label: entry.label,
  provider: entry.provider,
  family: entry.family,
  tier: entry.tier,
  sizeLabel: entry.sizeLabel,
  description: entry.description,
  bundled: Boolean(entry.bundled),
  runtime: entry.runtime ?? null,
  file: entry.file ?? null,
  source: entry.huggingFaceUrl,
  // Set once the file is mirrored or hashed; the app checks it when present.
  sha256: entry.sha256 ?? null,
}))

const out = path.join(root, 'dist', 'v1')
mkdirSync(out, { recursive: true })
writeFileSync(
  path.join(out, 'models.json'),
  JSON.stringify(signManifest({ schema: 1, issuedAt, models }, privateKeyPem, keyId), null, 2),
)
writeFileSync(
  path.join(out, 'latest.json'),
  JSON.stringify(signManifest({ schema: 1, issuedAt, ...release }, privateKeyPem, keyId), null, 2),
)
console.log(`built ${models.length} models and version ${release.version} into dist/v1/ (key ${keyId})`)
