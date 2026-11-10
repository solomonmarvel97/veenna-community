import { isoDateKey, localTodayDateStr } from '@/lib/dateUtils'

export type InsightsTrendPoint = {
  date: string
  words: number
  captures: number
}

export function validHeatmapPoints<T extends { date: string; words?: number }>(
  points: T[] | null | undefined,
): Array<T & { date: string }> {
  const out: Array<T & { date: string }> = []
  for (const point of points ?? []) {
    const date = isoDateKey(point.date)
    if (!date) continue
    out.push({ ...point, date })
  }
  return out
}

/** Fill missing days in a range so charts honor the Insights period selector. */
export function fillDailySeries(
  rows: Array<{ date: string; words?: number; captures?: number }>,
  days: number,
  today = new Date(),
): InsightsTrendPoint[] {
  const span = Number.isFinite(days) ? Math.min(90, Math.max(7, Math.round(days))) : 30
  const byDate = new Map<string, InsightsTrendPoint>()
  for (const row of rows) {
    const key = isoDateKey(row.date)
    if (!key) continue
    const existing = byDate.get(key) ?? { date: key, words: 0, captures: 0 }
    existing.words += row.words || 0
    existing.captures += row.captures || 0
    byDate.set(key, existing)
  }

  const cursor = new Date(today)
  cursor.setHours(12, 0, 0, 0)
  const out: InsightsTrendPoint[] = []
  for (let i = span - 1; i >= 0; i -= 1) {
    const day = new Date(cursor)
    day.setDate(cursor.getDate() - i)
    const key = localTodayDateStr(day)
    out.push(byDate.get(key) ?? { date: key, words: 0, captures: 0 })
  }
  return out
}
