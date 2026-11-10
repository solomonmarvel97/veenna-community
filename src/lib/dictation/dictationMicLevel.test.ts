import { describe, expect, it } from 'vitest'
import {
  MIC_SPEECH_RMS_GATE,
  MIC_WAVE_IDLE_LEVEL,
  createMicWaveNormalizer,
} from '@/lib/dictation/dictationMicLevel'

describe('createMicWaveNormalizer', () => {
  it('returns idle level for silence', () => {
    const normalizer = createMicWaveNormalizer()
    expect(normalizer.sample(0)).toBe(MIC_WAVE_IDLE_LEVEL)
    expect(normalizer.sample(MIC_SPEECH_RMS_GATE * 0.5)).toBe(MIC_WAVE_IDLE_LEVEL)
  })

  it('returns elevated bars for sustained speech', () => {
    const normalizer = createMicWaveNormalizer()
    for (let i = 0; i < 8; i += 1) {
      normalizer.sample(0.08)
    }
    const level = normalizer.sample(0.08)
    expect(level).toBeGreaterThan(MIC_WAVE_IDLE_LEVEL + 0.05)
  })

  it('resets peak tracking', () => {
    const normalizer = createMicWaveNormalizer()
    for (let i = 0; i < 8; i += 1) {
      normalizer.sample(0.08)
    }
    normalizer.reset()
    expect(normalizer.sample(0)).toBe(MIC_WAVE_IDLE_LEVEL)
  })
})
