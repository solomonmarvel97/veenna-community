import { describe, expect, it } from 'vitest'
import { buildGuestInsightsSummary } from './guestInsights'
import type { VoiceCapture } from '@/stores/voiceCaptures'

function capture(partial: Partial<VoiceCapture> & Pick<VoiceCapture, 'id' | 'text'>): VoiceCapture {
  return {
    createdAt: '2026-08-14T12:00:00.000Z',
    wordCount: partial.text.trim().split(/\s+/).filter(Boolean).length,
    durationMs: 2000,
    source: 'dictation',
    hasAudio: false,
    ...partial,
  }
}

describe('buildGuestInsightsSummary', () => {
  it('tracks source mix and streaks from local captures', () => {
    const summary = buildGuestInsightsSummary([
      capture({
        id: '1',
        text: 'hello world',
        wordCount: 3,
        source: 'hotkey',
        createdAt: '2026-08-14T12:00:00.000Z',
      }),
      capture({
        id: '2',
        text: 'add milk',
        source: 'manual',
        createdAt: '2026-08-13T12:00:00.000Z',
      }),
    ])

    expect(summary.totalCaptures).toBe(2)
    expect(summary.sourceBreakdown?.hotkey).toBe(1)
    expect(summary.sourceBreakdown?.manual).toBe(1)
    expect(summary.heatmap.length).toBeGreaterThan(0)
    expect(summary.longestStreak).toBeGreaterThanOrEqual(summary.dayStreak)
  })
})

describe('averageWpm', () => {
  // 750 characters = 150 standard (5-character) words.
  const text = 'abcd '.repeat(150)

  it('times like a typing test: standard words over speaking time', () => {
    const summary = buildGuestInsightsSummary([
      capture({ id: 'a', text, durationMs: 90_000, speechDurationMs: 60_000 }),
    ])
    expect(summary.averageWpm).toBe(150)
  })

  it('ignores wall-clock rows once speaking-time rows exist', () => {
    const summary = buildGuestInsightsSummary([
      capture({ id: 'a', text, durationMs: 90_000, speechDurationMs: 60_000 }),
      capture({ id: 'old', text, durationMs: 300_000 }),
    ])
    expect(summary.averageWpm).toBe(150)
  })
})
