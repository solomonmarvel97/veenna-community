import { describe, expect, it } from 'vitest'
import {
  isListableVoiceCapture,
  isUntitledRecordingLabel,
  untitledRecordingText,
} from './untitledRecording'

describe('untitledRecordingText', () => {
  it('labels short recordings with seconds', () => {
    expect(untitledRecordingText(12_400)).toBe('Recording · 12s')
  })

  it('labels longer recordings as m:ss', () => {
    expect(untitledRecordingText(125_000)).toBe('Recording · 2:05')
  })

})

describe('isUntitledRecordingLabel', () => {
  it('matches placeholder recording titles', () => {
    expect(isUntitledRecordingLabel('Recording · 2s')).toBe(true)
    expect(isUntitledRecordingLabel('Recording')).toBe(true)
    expect(isUntitledRecordingLabel("that's what I call it.")).toBe(false)
  })
})

describe('isListableVoiceCapture', () => {
  it('lists captures that have playable audio', () => {
    expect(
      isListableVoiceCapture({ hasAudio: true, durationMs: 12_000, text: 'Recording · 12s' }),
    ).toBe(true)
  })

  it('hides too-short placeholder recordings even when audio exists', () => {
    expect(
      isListableVoiceCapture({ hasAudio: true, durationMs: 2_000, text: 'Recording · 2s' }),
    ).toBe(false)
  })

  it('hides untitled placeholders that cannot be transcribed', () => {
    expect(isListableVoiceCapture({ hasAudio: false, text: 'Recording · 2s' })).toBe(false)
  })

  it('keeps real transcripts even without local audio', () => {
    expect(isListableVoiceCapture({ hasAudio: false, text: "that's what I call it." })).toBe(true)
  })

  it('keeps longer placeholders that have audio', () => {
    expect(
      isListableVoiceCapture({
        hasAudio: true,
        durationMs: 45_000,
        text: 'Recording · 45s',
      }),
    ).toBe(true)
  })
})
