/**
 * W3C-shaped ids, minted in the browser.
 *
 * The trace id is created at the interaction - before any network call - which
 * is the whole reason this file exists on the client at all. See
 * docs/plans/tracing.md §1.
 */

const HEX = '0123456789abcdef'

/** crypto.getRandomValues everywhere real; Math.random only where it is absent. */
function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  const cryptoObj = globalThis.crypto
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes)
    return bytes
  }
  for (let i = 0; i < length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256)
  }
  return bytes
}

function toHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i]
    out += HEX[(byte >> 4) & 0x0f]
    out += HEX[byte & 0x0f]
  }
  return out
}

export function newTraceId(): string {
  return toHex(randomBytes(16))
}

export function newSpanId(): string {
  return toHex(randomBytes(8))
}

/**
 * Lowercase hex of an exact length, not all zeros.
 * An explicit scan rather than a pattern: this runs on every request.
 */
export function isHexId(value: unknown, length: number): boolean {
  if (typeof value !== 'string' || value.length !== length) return false
  let nonZero = false
  for (let i = 0; i < length; i += 1) {
    const c = value.charCodeAt(i)
    const isDigit = c >= 48 && c <= 57
    const isLowerAf = c >= 97 && c <= 102
    if (!isDigit && !isLowerAf) return false
    if (c !== 48) nonZero = true
  }
  return nonZero
}

export function isTraceId(value: unknown): value is string {
  return isHexId(value, 32)
}

export function isSpanId(value: unknown): value is string {
  return isHexId(value, 16)
}
