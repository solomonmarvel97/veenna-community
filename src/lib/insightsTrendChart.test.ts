import { describe, it, expect } from 'vitest'
import { barSlotCenter, niceScale, pickXTickIndices } from '@/lib/insightsTrendChart'

describe('niceScale', () => {
  it('returns a zero scale for empty data', () => {
    expect(niceScale(0)).toEqual({ max: 1, ticks: [0, 1] })
  })

  it('rounds the top of the axis to a readable step', () => {
    const scale = niceScale(726)
    expect(scale.max).toBeGreaterThanOrEqual(726)
    expect(scale.ticks[0]).toBe(0)
    expect(scale.ticks.at(-1)).toBe(scale.max)
    expect(scale.ticks.length).toBeLessThanOrEqual(5)
  })
})

describe('pickXTickIndices', () => {
  it('keeps every day when the series is short', () => {
    expect(pickXTickIndices(7)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('always includes the first and last day on a long series', () => {
    const ticks = pickXTickIndices(30, 7)
    expect(ticks[0]).toBe(0)
    expect(ticks.at(-1)).toBe(29)
    expect(ticks.length).toBeLessThanOrEqual(7)
  })
})

describe('barSlotCenter', () => {
  it('centers a lone bar', () => {
    expect(barSlotCenter(0, 1)).toBe(50)
  })

  it('places seven daily bars in even slots', () => {
    expect(barSlotCenter(0, 7)).toBeCloseTo(100 / 14)
    expect(barSlotCenter(6, 7)).toBeCloseTo(100 - 100 / 14)
  })
})
