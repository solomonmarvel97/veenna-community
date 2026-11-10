import { localTodayDateStr } from '@/lib/dateUtils'

export function localDateKeyFromIso(iso: string): string {
  return localTodayDateStr(new Date(iso))
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return localTodayDateStr(dt)
}

/** Consecutive-day streak ending today (inclusive). */
export function computeDayStreak(
  activeDateKeys: Iterable<string>,
  todayKey = localTodayDateStr(),
): number {
  const days = new Set(activeDateKeys)
  if (!days.size) return 0

  let streak = 0
  let cursor = todayKey
  while (days.has(cursor)) {
    streak += 1
    cursor = addDaysToDateKey(cursor, -1)
  }
  return streak
}

/** Longest consecutive run in a set of YYYY-MM-DD keys. */
export function computeLongestStreak(activeDateKeys: Iterable<string>): number {
  const sorted = [...new Set(activeDateKeys)].filter(Boolean).sort((a, b) => b.localeCompare(a))
  if (!sorted.length) return 0
  let longest = 1
  let current = 1
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] === addDaysToDateKey(sorted[i - 1], -1)) {
      current += 1
      longest = Math.max(longest, current)
    } else {
      current = 1
    }
  }
  return longest
}
