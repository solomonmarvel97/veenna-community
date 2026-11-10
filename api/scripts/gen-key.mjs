// Makes an ed25519 signing key. The private half goes to api/.keys/ (never committed);
// the public half to api/keys/<name>.public.pem and, by hand, into the app's electron/config/manifestKeys.cjs.
// Production keys are the owner's to make and keep: run this on the machine that will hold them.
import { generateKeyPairSync } from 'node:crypto'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const name = process.argv[2] || 'dev'
const privatePath = path.join(root, '.keys', `${name}.private.pem`)
if (existsSync(privatePath)) {
  console.error(`${privatePath} already exists; refusing to overwrite a signing key.`)
  process.exit(1)
}
const { publicKey, privateKey } = generateKeyPairSync('ed25519')
mkdirSync(path.join(root, '.keys'), { recursive: true, mode: 0o700 })
mkdirSync(path.join(root, 'keys'), { recursive: true })
writeFileSync(privatePath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })
writeFileSync(path.join(root, 'keys', `${name}.public.pem`), publicKey.export({ type: 'spki', format: 'pem' }))
console.log(`wrote .keys/${name}.private.pem (keep secret) and keys/${name}.public.pem`)
