import { describe, expect, it } from 'vitest'
import { waveBarGap, waveBarShape, waveBarWidth } from '@/lib/dictation/waveBarShape'

describe('waveBarShape', () => {
  it('draws a centred dot at idle', () => {
    const shape = waveBarShape({ barWidth: 3, canvasHeight: 24, activity: 0, x: 4 })

    expect(shape.width).toBe(3)
    expect(shape.height).toBe(3)
    expect(shape.radius).toBe(1.5)
    expect(shape.x).toBe(4)
    expect(shape.y).toBe(10.5)
  })

  it('grows to the full height as a capsule at full activity', () => {
    const shape = waveBarShape({ barWidth: 3, canvasHeight: 24, activity: 1, x: 0 })

    expect(shape.height).toBe(24)
    expect(shape.y).toBe(0)
    expect(shape.radius).toBe(1.5)
  })

  it('clamps activity outside 0..1', () => {
    expect(waveBarShape({ barWidth: 2, canvasHeight: 16, activity: -1, x: 0 }).height).toBe(2)
    expect(waveBarShape({ barWidth: 2, canvasHeight: 16, activity: 4, x: 0 }).height).toBe(16)
  })

  it('keeps bars thin across canvas sizes', () => {
    expect(waveBarWidth(16)).toBe(2)
    expect(waveBarWidth(28)).toBeCloseTo(3.08)
    expect(waveBarWidth(80)).toBe(3.5)
    expect(waveBarGap(2)).toBe(1.6)
  })
})
