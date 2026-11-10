// Shapes of the Insights page data. The numbers are worked out on this device from saved dictations.

export type VoiceInsightsApp = {
  appName: string
  category: string
  wordCount: number
  captureCount: number
  lastUsedAt: string | null
  percent: number
}

export type VoiceInsightsHeatmapPoint = { date: string; words: number }

export type VoiceInsightsSourceBreakdown = {
  dictation: number
  hotkey: number
  manual: number
}

export type VoiceInsightsSummary = {
  totalWords: number
  totalCaptures: number
  averageWpm: number
  dayStreak: number
  longestStreak: number
  monthOverMonthPct: number
  heatmap: VoiceInsightsHeatmapPoint[]
  platformUsage: {
    desktop: number
    mobile: number
    desktopWords: number
    mobileWords: number
  }
  sourceBreakdown?: VoiceInsightsSourceBreakdown
  avgDurationMs?: number
}

/** Words and dictations on one day. */
export type VeennaDailyTrendPoint = { date: string; words: number; captures: number }

export type VeennaAnalyticsPayload = {
  periodDays: number
  voice: VoiceInsightsSummary
  dailyTrend: VeennaDailyTrendPoint[]
}
