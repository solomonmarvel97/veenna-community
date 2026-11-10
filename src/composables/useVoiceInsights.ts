import { computed } from 'vue'
import { heatmapFromCaptures } from '@/lib/activityHeatmap'
import { formatGrowthBadge, USAGE_CATEGORY_META, type UsageCategoryId, wordsMilestone, wpmPaceLabel } from '@/lib/insightsCopy'
import { fillDailySeries, validHeatmapPoints } from '@/lib/insightsSeries'
import { useVeennaAnalyticsStore } from '@/stores/veennaAnalytics'
import { useVoiceCapturesStore } from '@/stores/voiceCaptures'
import type { VoiceInsightsApp, VoiceInsightsSummary } from '@/types/insights'

export type AggregatedUsageCategory = {
  id: UsageCategoryId
  label: string
  countLabel: string
  wordCount: number
  percent: number
  sessions: number
}

const emptySummary = (): VoiceInsightsSummary => ({
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
})

export function useVoiceInsights() {
  const voice = useVoiceCapturesStore()
  const analytics = useVeennaAnalyticsStore()

  const periodDays = computed(() => analytics.periodDays || 30)

  const summary = computed<VoiceInsightsSummary>(() => {
    const base = voice.insights
      ? { ...voice.insights }
      : {
          ...emptySummary(),
          totalWords: voice.totalWords,
          totalCaptures: voice.totalCaptures,
          averageWpm: voice.averageWpm,
          dayStreak: voice.dayStreak,
          longestStreak: voice.dayStreak,
          heatmap: heatmapFromCaptures(voice.captures),
          platformUsage: {
            desktop: voice.totalWords > 0 ? 100 : 0,
            mobile: 0,
            desktopWords: voice.totalWords,
            mobileWords: 0,
          },
        }

    if (!base.heatmap?.length && voice.captures.length) {
      base.heatmap = heatmapFromCaptures(voice.captures)
    }

    // Server insights can report 0 pace (no timed rows in its window) while the
    // locally loaded captures still yield one.
    if (!base.averageWpm) base.averageWpm = voice.averageWpm

    if (!base.longestStreak) base.longestStreak = base.dayStreak
    return base
  })

  const hasData = computed(() => summary.value.totalCaptures > 0 || summary.value.totalWords > 0)

  const loading = computed(() => !voice.localCapturesHydrated)

  const wpmRank = computed(() => wpmPaceLabel(summary.value.averageWpm))
  const milestone = computed(() => wordsMilestone(summary.value.totalWords))
  const growthBadge = computed(() => formatGrowthBadge(summary.value.monthOverMonthPct))

  const heatmapPoints = computed(() => {
    const fromSummary = validHeatmapPoints(summary.value.heatmap)
    if (fromSummary.length) return fromSummary
    return heatmapFromCaptures(voice.captures)
  })

  const categoryUsage = computed<AggregatedUsageCategory[]>(() => {
    const buckets = new Map<UsageCategoryId, { wordCount: number; sessions: number }>()
    for (const id of Object.keys(USAGE_CATEGORY_META) as UsageCategoryId[]) {
      buckets.set(id, { wordCount: 0, sessions: 0 })
    }

    if (voice.captures.length) {
      const other = buckets.get('other')!
      for (const capture of voice.captures) {
        other.wordCount += capture.wordCount || 0
        other.sessions += 1
      }
    }

    const total = [...buckets.values()].reduce((sum, b) => sum + b.wordCount, 0)
    return (Object.keys(USAGE_CATEGORY_META) as UsageCategoryId[]).map((id) => {
      const meta = USAGE_CATEGORY_META[id]
      const bucket = buckets.get(id)!
      return {
        id,
        label: meta.label,
        countLabel: meta.countLabel,
        wordCount: bucket.wordCount,
        sessions: bucket.sessions,
        percent: total ? Math.round((bucket.wordCount / total) * 100) : 0,
      }
    })
  })

  const trendSeries = computed(() => {
    const fromCaptures = heatmapPoints.value.map((point) => ({
      date: point.date,
      words: point.words,
      captures: point.words > 0 ? 1 : 0,
    }))

    return fillDailySeries(fromCaptures, periodDays.value)
  })

  const sourceBreakdown = computed(() => {
    const fromApi = summary.value.sourceBreakdown
    const apiTotal = fromApi
      ? fromApi.dictation + fromApi.hotkey + fromApi.manual
      : 0
    if (fromApi && apiTotal > 0) return fromApi

    const counts = { dictation: 0, hotkey: 0, manual: 0 }
    for (const item of voice.captures) {
      const key = item.source ?? 'dictation'
      if (key in counts) counts[key as keyof typeof counts] += 1
      else counts.dictation += 1
    }
    return counts
  })

  const avgDurationMs = computed(() => {
    if (summary.value.avgDurationMs) return summary.value.avgDurationMs
    const timed = voice.captures.filter((c) => c.durationMs && c.durationMs > 0)
    if (!timed.length) return 0
    const total = timed.reduce((sum, c) => sum + (c.durationMs ?? 0), 0)
    return Math.round(total / timed.length)
  })

  async function load() {
    await voice.ensureLocalCapturesHydrated()
  }

  return {
    loading,
    error: computed(() => null as string | null),
    summary,
    hasData,
    wpmRank,
    milestone,
    growthBadge,
    heatmapPoints,
    categoryUsage,
    trendSeries,
    totalApps: computed(() => 0),
    apps: computed<VoiceInsightsApp[]>(() => []),
    sourceBreakdown,
    avgDurationMs,
    load,
    refresh: () => voice.ensureLocalCapturesHydrated(),
  }
}
