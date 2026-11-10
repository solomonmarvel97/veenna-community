import type { VeennaAnalyticsPayload, VoiceInsightsSummary } from '@/types/insights'
import { buildGuestInsightsSummary } from '@/lib/guestInsights'
import type { VoiceCapture } from '@/stores/voiceCaptures'

const DAY_MS = 24 * 60 * 60 * 1000

function emptyVoiceSummary(): VoiceInsightsSummary {
  return {
    totalWords: 0,
    totalCaptures: 0,
    averageWpm: 0,
    dayStreak: 0,
    longestStreak: 0,
    monthOverMonthPct: 0,
    heatmap: [],
    platformUsage: { desktop: 0, mobile: 0, desktopWords: 0, mobileWords: 0 },
    sourceBreakdown: { dictation: 0, hotkey: 0, manual: 0 },
    avgDurationMs: 0,
  }
}

/** The Insights data, built from the dictations saved on this device. */
export function buildLocalAnalyticsPayload(params: {
  periodDays: number
  captures: VoiceCapture[]
  insights: VoiceInsightsSummary | null
}): VeennaAnalyticsPayload {
  const voice =
    params.insights ??
    (params.captures.length ? buildGuestInsightsSummary(params.captures) : emptyVoiceSummary())

  const cutoff = Date.now() - params.periodDays * DAY_MS
  const byDay = new Map<string, { words: number; captures: number }>()
  for (const capture of params.captures) {
    const time = Date.parse(capture.createdAt)
    if (!Number.isFinite(time) || time < cutoff) continue
    const date = String(capture.createdAt).slice(0, 10)
    const bucket = byDay.get(date) ?? { words: 0, captures: 0 }
    bucket.words += capture.wordCount || 0
    bucket.captures += 1
    byDay.set(date, bucket)
  }

  const dailyTrend = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, row]) => ({ date, ...row }))

  return { periodDays: params.periodDays, voice, dailyTrend }
}
