import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'

/** JSON with object keys sorted at every depth, so a signature does not depend on key order. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** Wraps a payload in a signed envelope: { keyId, payload, signature (base64 ed25519) }. */
export function signManifest(payload, privateKeyPem, keyId) {
  const key = createPrivateKey(privateKeyPem)
  const signature = sign(null, Buffer.from(canonicalJson(payload)), key).toString('base64')
  return { keyId, payload, signature }
}

/** True only when the envelope's signature matches its payload under this public key. */
export function verifyManifest(envelope, publicKeyPem) {
  try {
    if (!envelope || typeof envelope.signature !== 'string' || !envelope.payload) return false
    const key = createPublicKey(publicKeyPem)
    return verify(null, Buffer.from(canonicalJson(envelope.payload)), key, Buffer.from(envelope.signature, 'base64'))
  } catch {
    return false
  }
}
