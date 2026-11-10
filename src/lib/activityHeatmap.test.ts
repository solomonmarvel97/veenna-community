import { describe, expect, it } from 'vitest'
import {
  buildActivityHeatmap,
  spaceHeatmapMonthLabels,
  type HeatmapMonthLabel,
} from '@/lib/activityHeatmap'

describe('spaceHeatmapMonthLabels', () => {
  it('drops the earlier label when two months start one week apart', () => {
    const months: HeatmapMonthLabel[] = [
      { label: 'Jan', weekIndex: 0 },
      { label: 'Feb', weekIndex: 1 },
      { label: 'Mar', weekIndex: 5 },
    ]
    expect(spaceHeatmapMonthLabels(months)).toEqual([
      { label: 'Feb', weekIndex: 1 },
      { label: 'Mar', weekIndex: 5 },
    ])
  })

  it('keeps both labels when they have a spare week between them', () => {
    const months: HeatmapMonthLabel[] = [
      { label: 'Nov', weekIndex: 0 },
      { label: 'Dec', weekIndex: 2 },
    ]
    expect(spaceHeatmapMonthLabels(months)).toEqual(months)
  })
})

describe('buildActivityHeatmap month labels', () => {
  it('does not emit colliding labels when the range starts on a month boundary', () => {
    // Sunday 1 Feb 2026: week 0 is 1 Feb (Feb). 13 weeks earlier is 2 Nov 2025
    // (Nov), and 30 Nov 2025 is the last Nov Sunday - one week before Dec.
    const today = new Date(2026, 8, 16) // 16 Sep 2026
    const { months } = buildActivityHeatmap([], 42, today)
    const weekIndexes = months.map((m) => m.weekIndex)
    for (let i = 1; i < weekIndexes.length; i += 1) {
      expect(weekIndexes[i]! - weekIndexes[i - 1]!).toBeGreaterThanOrEqual(2)
    }
  })

  it('hides a one-week January stub in front of February', () => {
    // Range starts Sun 25 Jan 2026; next Sunday is 1 Feb.
    const today = new Date(2026, 3, 22) // 22 Apr 2026
    const { months } = buildActivityHeatmap([], 13, today)
    expect(months[0]).toEqual({ label: 'Feb', weekIndex: 1 })
    expect(months.some((m) => m.label === 'Jan')).toBe(false)
  })
})
