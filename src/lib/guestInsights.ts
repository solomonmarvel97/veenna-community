import type { VoiceInsightsSummary } from '@/types/insights'
import { heatmapFromCaptures } from '@/lib/activityHeatmap'
import { computeDayStreak, computeLongestStreak, localDateKeyFromIso } from '@/lib/voice/voiceStreak'
import { localTodayDateStr } from '@/lib/dateUtils'
import { getLocalAppSetting, setLocalAppSetting } from '@/lib/localStore/localStoreClient'
import type { VoiceCapture } from '@/stores/voiceCaptures'

const INSIGHTS_KEY = 'voice_insights_summary'

function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

/** Prefer measured speaking time over wall-clock recording time for wpm math. */
function effectiveSpeechMs(item: Pick<VoiceCapture, 'speechDurationMs' | 'durationMs'>): number {
  if (item.speechDurationMs && item.speechDurationMs > 0) return item.speechDurationMs
  return item.durationMs ?? 0
}

/**
 * wpm is a pace stat, not a running total - weight it toward recent activity so
 * it moves with how someone is dictating lately instead of sitting anchored to
 * a lifetime average that a few hundred old rows can outweigh for good. Mirrors
 * the server calc in veennaVoiceInsightsService.js (WPM_WINDOW_DAYS).
 */
const WPM_WINDOW_DAYS = 30
const STANDARD_WORD_CHARS = 5

function computeAverageWpm(captures: VoiceCapture[]): number {
  const windowStart = Date.now() - WPM_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const timed = captures.filter((item) => effectiveSpeechMs(item) > 0)
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

export function buildGuestInsightsSummary(captures: VoiceCapture[]): VoiceInsightsSummary {
  const totalWords = captures.reduce(
    (sum, item) => sum + (item.wordCount || countWords(item.text)),
    0,
  )
  const totalCaptures = captures.length
  // avgDurationMs reports actual recording length (mic-open to mic-close);
  // wpm uses speech-only time so pauses don't drag the pace down.
  const timed = captures.filter(
    (item) => item.durationMs && item.durationMs > 0,
  )
  const totalDurationMs = timed.reduce((sum, item) => sum + (item.durationMs ?? 0), 0)
  const averageWpm = computeAverageWpm(captures)

  const dateKeys = captures.map((item) => localDateKeyFromIso(item.createdAt))
  const today = localTodayDateStr()
  const streak = computeDayStreak(dateKeys, today)

  const sourceBreakdown = { dictation: 0, hotkey: 0, manual: 0 }
  for (const item of captures) {
    const key = item.source ?? 'dictation'
    if (key in sourceBreakdown) sourceBreakdown[key] += 1
    else sourceBreakdown.dictation += 1
  }

  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`
  let wordsThisMonth = 0
  let wordsLastMonth = 0
  for (const item of captures) {
    const month = localDateKeyFromIso(item.createdAt).slice(0, 7)
    const words = item.wordCount || countWords(item.text)
    if (month === thisMonth) wordsThisMonth += words
    else if (month === lastMonth) wordsLastMonth += words
  }
  let monthOverMonthPct = 0
  if (wordsLastMonth > 0) {
    monthOverMonthPct = Math.round(((wordsThisMonth - wordsLastMonth) / wordsLastMonth) * 1000) / 10
  } else if (wordsThisMonth > 0) {
    monthOverMonthPct = 100
  }

  return {
    totalWords,
    totalCaptures,
    averageWpm,
    dayStreak: streak,
    longestStreak: computeLongestStreak(dateKeys),
    monthOverMonthPct,
    heatmap: heatmapFromCaptures(captures),
    platformUsage: {
      desktop: totalCaptures > 0 ? 100 : 0,
      mobile: 0,
      desktopWords: totalWords,
      mobileWords: 0,
    },
    sourceBreakdown,
    avgDurationMs: timed.length ? Math.round(totalDurationMs / timed.length) : 0,
  }
}

export async function persistGuestInsightsSummary(captures: VoiceCapture[]) {
  const summary = buildGuestInsightsSummary(captures)
  await setLocalAppSetting(INSIGHTS_KEY, summary)
  return summary
}

export async function readGuestInsightsSummary(): Promise<VoiceInsightsSummary | null> {
  const value = await getLocalAppSetting(INSIGHTS_KEY)
  if (!value || typeof value !== 'object') return null
  return value as VoiceInsightsSummary
}
