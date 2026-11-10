import type { VoiceCapture } from './types'

/** Searching and ordering captures. */

/** Does the capture's text (raw or refined) contain the search text? */
export function captureMatchesQuery(item: VoiceCapture, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = item.text.toLowerCase()
  return haystack.includes(q)
}
