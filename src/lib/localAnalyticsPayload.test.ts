import { describe, expect, it } from 'vitest'
import { buildLocalAnalyticsPayload } from './localAnalyticsPayload'
import type { VoiceCapture } from '@/stores/voiceCaptures'

function capture(partial: Partial<VoiceCapture> & Pick<VoiceCapture, 'id' | 'text'>): VoiceCapture {
  return {
    createdAt: '2026-08-09T12:00:00.000Z',
    wordCount: partial.text.trim().split(/\s+/).filter(Boolean).length,
    durationMs: 2000,
    source: 'dictation',
    hasAudio: false,
    ...partial,
  }
}

describe('buildLocalAnalyticsPayload', () => {
  it('builds voice stats from local captures', () => {
    // Dates relative to now so the fixed 30-day window never ages out.
    const dayMs = 24 * 60 * 60 * 1000
    const daysAgo = (days: number) => new Date(Date.now() - days * dayMs).toISOString()

    const captures = [
      capture({ id: '1', text: 'hello world', createdAt: daysAgo(0) }),
      capture({
        id: '2',
        text: 'one two three',
        wordCount: 4,
        createdAt: daysAgo(1),
      }),
    ]

    const payload = buildLocalAnalyticsPayload({
      periodDays: 30,
      captures,
      insights: null,
    })

    expect(payload.voice.totalCaptures).toBe(2)
    expect(payload.voice.totalWords).toBeGreaterThan(0)
    expect(payload.dailyTrend.length).toBeGreaterThan(0)
  })

  it('returns empty voice summary when there are no captures', () => {
    const payload = buildLocalAnalyticsPayload({
      periodDays: 7,
      captures: [],
      insights: null,
    })
    expect(payload.voice.totalCaptures).toBe(0)
    expect(payload.voice.totalWords).toBe(0)
  })
})
