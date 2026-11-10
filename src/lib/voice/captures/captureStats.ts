import type { VoiceCapture } from './types'

/** Word counts and speaking pace for dictations. */

export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

/** Prefer measured speaking time over wall-clock recording time for wpm math. */
function effectiveSpeechMs(item: Pick<VoiceCapture, 'speechDurationMs' | 'durationMs'>): number {
  if (item.speechDurationMs && item.speechDurationMs > 0) return item.speechDurationMs
  return item.durationMs ?? 0
}

/**
 * wpm is a pace stat, not a running total - weight it toward recent activity so
 * it moves with how someone is dictating lately instead of sitting anchored to
 * a lifetime average that a few hundred old rows can outweigh for good. A
 * dormant account (nothing in the window) falls back to its lifetime pace
 * rather than showing a bare 0. Mirrors the server calc in
 * veennaVoiceInsightsService.js (WPM_WINDOW_DAYS).
 */
const WPM_WINDOW_DAYS = 30
const STANDARD_WORD_CHARS = 5

export function computeAverageWpm(items: VoiceCapture[]): number {
  const windowStart = Date.now() - WPM_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const timed = items.filter((item) => effectiveSpeechMs(item) > 0)
  const wpmFrom = (rows: VoiceCapture[]) => {
    if (!rows.length) return 0
    // Standard typing-test words: every 5 characters, spaces included.
    const chars = rows.reduce((sum, item) => sum + item.text.length, 0)
    const minutes = rows.reduce((sum, item) => sum + effectiveSpeechMs(item) / 60000, 0)
    return minutes > 0 ? Math.round(chars / STANDARD_WORD_CHARS / minutes) : 0
  }
  const isRecent = (item: VoiceCapture) => new Date(item.createdAt).getTime() >= windowStart
  // speechDurationMs is typing-test speaking time (first word to last, pauses
  // capped); wall-clock time counts every pause, so never blend the two:
  // measured rows decide the pace, wall-clock only when none have it.
  const voiced = timed.filter((item) => item.speechDurationMs && item.speechDurationMs > 0)
  return (
    wpmFrom(voiced.filter(isRecent)) ||
    wpmFrom(voiced) ||
    wpmFrom(timed.filter(isRecent)) ||
    wpmFrom(timed)
  )
}
