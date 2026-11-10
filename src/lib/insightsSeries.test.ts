import { describe, expect, it } from 'vitest'
import { fillDailySeries, validHeatmapPoints } from './insightsSeries'

describe('insightsSeries', () => {
  it('drops heatmap points whose dates are not YYYY-MM-DD', () => {
    expect(
      validHeatmapPoints([
        { date: '2026-08-14', words: 12 },
        { date: 'Fri Aug 14', words: 9 },
        { date: '2026-08-14T00:00:00.000Z', words: 4 },
      ]),
    ).toEqual([
      { date: '2026-08-14', words: 12 },
      { date: '2026-08-14', words: 4 },
    ])
  })

  it('fills the selected period so charts do not collapse to active days only', () => {
    const series = fillDailySeries(
      [{ date: '2026-08-14', words: 20, captures: 2 }],
      7,
      new Date('2026-08-14T15:00:00'),
    )

    expect(series).toHaveLength(7)
    expect(series[0]?.date).toBe('2026-08-08')
    expect(series[series.length - 1]).toEqual({ date: '2026-08-14', words: 20, captures: 2 })
    expect(series[0]?.words).toBe(0)
  })
})
