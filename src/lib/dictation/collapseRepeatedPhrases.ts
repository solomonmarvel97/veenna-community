/**
 * Cleans the repeats Whisper sometimes emits: a sentence said twice in a row, or a run of
 * four or more words repeated back to back. Plain string handling, no pattern matching.
 */

function isSpace(char: string): boolean {
  return char === ' ' || char === '\n' || char === '\t' || char === '\r' || char === ' '
}

/** Words separated by single spaces, with every other whitespace run dropped. */
function words(text: string): string[] {
  const found: string[] = []
  let current = ''
  for (const char of String(text || '')) {
    if (isSpace(char)) {
      if (current) found.push(current)
      current = ''
    } else {
      current += char
    }
  }
  if (current) found.push(current)
  return found
}

function isCompareChar(char: string): boolean {
  return (
    (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') || char === "'" || isSpace(char)
  )
}

/** Lowercase, letters and digits only, "all right" and "alright" the same. */
function normalizeForCompare(text: string): string {
  let kept = ''
  for (const char of String(text || '').toLowerCase()) {
    kept += isCompareChar(char) ? char : ' '
  }
  const parts = words(kept)
  const merged: string[] = []
  for (let i = 0; i < parts.length; i += 1) {
    if (parts[i] === 'all' && parts[i + 1] === 'right') {
      merged.push('alright')
      i += 1
    } else {
      merged.push(parts[i])
    }
  }
  return merged.join(' ')
}

/** Sentences, split where whitespace follows a full stop, question mark or exclamation mark. */
function sentences(text: string): string[] {
  const joined = words(text).join(' ')
  const parts: string[] = []
  let current = ''
  for (let i = 0; i < joined.length; i += 1) {
    const char = joined[i]
    current += char
    const next = joined[i + 1]
    if ((char === '.' || char === '!' || char === '?') && next === ' ') {
      parts.push(current.trim())
      current = ''
      i += 1
    }
  }
  if (current.trim()) parts.push(current.trim())
  return parts.filter(Boolean)
}

/** Drops sentences that repeat an earlier one. */
export function dedupeRepeatedSentences(text: string): string {
  const joined = words(text).join(' ')
  if (!joined) return joined
  const parts = sentences(joined)
  if (parts.length <= 1) return joined
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of parts) {
    const key = normalizeForCompare(part)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(part)
  }
  return out.join(' ')
}

/** Collapses a run of words repeated back to back. */
export function collapseRepeatedPhrases(text: string): string {
  const cleaned = dedupeRepeatedSentences(text)
  if (!cleaned) return cleaned
  const all = cleaned.split(' ')
  if (all.length < 8) return cleaned
  for (let size = Math.min(16, Math.floor(all.length / 2)); size >= 4; size -= 1) {
    for (let i = 0; i <= all.length - size * 2; i += 1) {
      const first = all.slice(i, i + size).join(' ').toLowerCase()
      const second = all.slice(i + size, i + size * 2).join(' ').toLowerCase()
      if (first === second) {
        const next = [...all.slice(0, i + size), ...all.slice(i + size * 2)].join(' ')
        return collapseRepeatedPhrases(next)
      }
    }
  }
  return cleaned
}
