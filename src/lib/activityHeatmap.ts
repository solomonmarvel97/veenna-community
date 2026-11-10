import { addDays, format, startOfWeek, subWeeks } from 'date-fns'
import type { VoiceInsightsHeatmapPoint } from '@/types/insights'

export type HeatmapLevel = 0 | 1 | 2 | 3 | 4

type HeatmapCell = {
  date: string
  words: number
  level: HeatmapLevel
  inRange: boolean
}

export type HeatmapWeek = {
  cells: HeatmapCell[]
}

export type HeatmapMonthLabel = {
  label: string
  weekIndex: number
}

/**
 * Adjacent week columns are 14px apart (11px cell + 3px gap). A 10px "Sep"
 * is ~22px, so labels one week apart render as "JanFeb". Keep the later month.
 */
const HEATMAP_MONTH_LABEL_MIN_WEEKS = 2

const LEVEL_THRESHOLDS = [1, 50, 150, 400] as const

/** Drop a month label that would collide with the next one in the header row. */
export function spaceHeatmapMonthLabels(months: HeatmapMonthLabel[]): HeatmapMonthLabel[] {
  const kept: HeatmapMonthLabel[] = []
  for (const month of months) {
    const prev = kept[kept.length - 1]
    if (prev && month.weekIndex - prev.weekIndex < HEATMAP_MONTH_LABEL_MIN_WEEKS) {
      kept[kept.length - 1] = month
      continue
    }
    kept.push(month)
  }
  return kept
}

function wordsToLevel(words: number): HeatmapLevel {
  if (words <= 0) return 0
  if (words < LEVEL_THRESHOLDS[1]) return 1
  if (words < LEVEL_THRESHOLDS[2]) return 2
  if (words < LEVEL_THRESHOLDS[3]) return 3
  return 4
}

/** Build a GitHub-style contribution grid (Sun→Sat rows, weeks as columns). */
export function buildActivityHeatmap(
  points: VoiceInsightsHeatmapPoint[],
  weeks = 21,
  today = new Date(),
): {
  weeks: HeatmapWeek[]
  months: HeatmapMonthLabel[]
  maxWords: number
} {
  const byDate = new Map(points.map((p) => [p.date, p.words]))
  const end = startOfWeek(today, { weekStartsOn: 0 })
  const start = subWeeks(end, weeks - 1)

  const weekColumns: HeatmapWeek[] = []
  const months: HeatmapMonthLabel[] = []
  let lastMonth = ''

  for (let w = 0; w < weeks; w += 1) {
    const weekStart = addDays(start, w * 7)
    const cells: HeatmapCell[] = []
    for (let d = 0; d < 7; d += 1) {
      const day = addDays(weekStart, d)
      const key = format(day, 'yyyy-MM-dd')
      const words = byDate.get(key) ?? 0
      const inRange = day <= today
      cells.push({
        date: key,
        words: inRange ? words : 0,
        level: inRange ? wordsToLevel(words) : 0,
        inRange,
      })
    }
    weekColumns.push({ cells })

    const month = format(weekStart, 'MMM')
    if (month !== lastMonth) {
      months.push({ label: month, weekIndex: w })
      lastMonth = month
    }
  }

  const maxWords = Math.max(0, ...points.map((p) => p.words))
  return { weeks: weekColumns, months: spaceHeatmapMonthLabels(months), maxWords }
}

/** Aggregate captures into heatmap points when the API has no daily stats yet. */
export function heatmapFromCaptures(
  captures: Array<{ createdAt: string; wordCount: number }>,
): VoiceInsightsHeatmapPoint[] {
  const map = new Map<string, number>()
  for (const item of captures) {
    const key = format(new Date(item.createdAt), 'yyyy-MM-dd')
    map.set(key, (map.get(key) ?? 0) + (item.wordCount || 0))
  }
  return [...map.entries()]
    .map(([date, words]) => ({ date, words }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
