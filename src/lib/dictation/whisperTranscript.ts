/** Speech-activity types and the "was that real speech?" check for on-device dictation. */

const PHANTOM_LINES = new Set([
  'thank you', 'thank you.', 'thanks', 'thanks.', 'thank you for watching', 'thanks for watching',
  'thanks for listening', 'thank you for listening', 'please subscribe', 'subscribe', 'you', 'bye',
  'goodbye', 'the end', 'end', 'music', '[music]', 'applause', '[applause]', 'okay', 'okay.', 'ok',
  'ok.', 'mm hmm', 'mm-hmm', 'mhm', 'uh', 'um', 'subtitle', 'subtitles', 'silence',
  'ご視聴ありがとうございました', 'ありがとうございました', '字幕由社区贡献',
  '请不吝点赞 订阅 转发 打赏支持明镜与点点栏目',
])

const SHORT_FILLERS = new Set([
  'ok', 'okay', 'um', 'uh', 'hmm', 'mm hmm', 'mm-hmm', 'mmhmm', 'mhm', 'yeah', 'oh', 'ah', 'so',
  'well', 'right', 'alright', 'hi', 'hello', 'hey',
])

const TRAILING_PUNCTUATION = '.!?,…'

export type MicLevelMonitor = {
  hadSpeechWithinMs: (windowMs: number) => boolean
  speechDurationMs: () => number
  /** Speaking time the way a typing test keeps time; the wpm denominator. */
  speakingMs?: () => number
  /** Analyser frames collected while the AudioContext was running (0: the mic was never heard). */
  /** Clear speech accumulators for a new listening turn. */
  resetSpeech?: () => void
  sampledFrameCount?: () => number
  dispose: () => void
}

export type SilentTranscriptContext = {
  speechDurationMs?: number | null
  recordingDurationMs?: number | null
  /** Minimum cumulative speech detected by the mic monitor. */
  minSpeechMs?: number
}

function words(text: string): string[] {
  return text.split(' ').filter(Boolean)
}

/** Collapse any run of whitespace to single spaces. */
function squash(text: string): string {
  let out = ''
  let pendingSpace = false
  for (const ch of String(text || '')) {
    if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r') {
      pendingSpace = out.length > 0
    } else {
      if (pendingSpace) out += ' '
      pendingSpace = false
      out += ch
    }
  }
  return out
}

function stripTrailingPunctuation(text: string): string {
  let end = text.length
  while (end > 0 && TRAILING_PUNCTUATION.includes(text[end - 1])) end--
  return text.slice(0, end)
}

function hasCjk(text: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if ((code >= 0x3000 && code <= 0x9fff) || (code >= 0xac00 && code <= 0xd7af)) return true
  }
  return false
}

function startsWithThanks(lower: string): boolean {
  for (const lead of ['thanks', 'thank you', 'thank']) {
    if (!lower.startsWith(lead)) continue
    const next = lower[lead.length]
    if (next === undefined || next === ' ' || TRAILING_PUNCTUATION.includes(next) || next === ',') return true
  }
  return false
}

/** Whisper's well-known phantom lines from near-silent audio. */
function isWhisperSliceHallucination(text: string, language = 'en'): boolean {
  const normalized = squash(text)
  if (!normalized) return true
  const lower = normalized.toLowerCase()
  if (PHANTOM_LINES.has(lower) || PHANTOM_LINES.has(normalized)) return true
  if (normalized.length <= 12 && startsWithThanks(lower)) return true
  if (
    normalized.length <= 40 &&
    (lower.includes('thanks for watching') || lower.includes('please subscribe') || lower.includes('subtitle'))
  ) {
    return true
  }
  if (normalized.length <= 16 && SHORT_FILLERS.has(stripTrailingPunctuation(lower))) return true
  if (String(language || 'en').toLowerCase() === 'en' && normalized.length <= 24 && hasCjk(normalized)) return true
  return false
}

/**
 * True when the transcript is probably phantom text from silence or noise rather than speech.
 * Combines the known phantom lines with how long the mic monitor heard actual speech.
 */
export function isLikelySilentWhisperTranscript(
  text: string,
  language = 'en',
  context: SilentTranscriptContext = {},
): boolean {
  if (isWhisperSliceHallucination(text, language)) return true
  const normalized = squash(text)
  if (!normalized) return true

  const minSpeechMs = context.minSpeechMs ?? 400
  const speechMs = context.speechDurationMs
  const recordingMs = context.recordingDurationMs
  const wordCount = words(normalized).length

  if (speechMs != null && speechMs < minSpeechMs) return true
  if (
    speechMs != null &&
    speechMs < minSpeechMs * 1.75 &&
    recordingMs != null &&
    recordingMs < 5000 &&
    wordCount <= 4
  ) {
    return true
  }
  if (wordCount <= 2 && speechMs != null && speechMs < 800) {
    if (SHORT_FILLERS.has(stripTrailingPunctuation(normalized.toLowerCase()))) return true
  }
  return false
}
