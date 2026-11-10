import { describe, expect, it } from 'vitest'
import {
  MIN_DICTATION_SPEECH_MS,
  shouldRejectDictationTranscript,
  shouldSkipDictationTranscription,
} from './dictationSilence'

describe('dictationSilence', () => {
  it('still transcribes when the mic monitor never sampled but the recording looks valid', () => {
    expect(
      shouldSkipDictationTranscription({
        speechDurationMs: 0,
        recordingDurationMs: 1200,
        audioBytes: 4000,
        language: 'en',
        monitorSampled: false,
      }),
    ).toBe(false)
    expect(
      shouldSkipDictationTranscription({
        speechDurationMs: MIN_DICTATION_SPEECH_MS,
        recordingDurationMs: 1200,
        audioBytes: 4000,
        language: 'en',
      }),
    ).toBe(false)
  })

  it('skips transcription when the mic heard silence, even on a long Option hold', () => {
    expect(
      shouldSkipDictationTranscription({
        speechDurationMs: 0,
        recordingDurationMs: 2400,
        audioBytes: 12_000,
        language: 'en',
        monitorSampled: true,
      }),
    ).toBe(true)
  })

  it('skips transcription when speech was too short and the hold was not long enough', () => {
    expect(
      shouldSkipDictationTranscription({
        speechDurationMs: 0,
        recordingDurationMs: 400,
        audioBytes: 4000,
        language: 'en',
      }),
    ).toBe(true)
  })

  it('rejects common Whisper silence hallucinations', () => {
    const quietContext = {
      speechDurationMs: 120,
      recordingDurationMs: 900,
      audioBytes: 4000,
      language: 'en',
    }
    expect(shouldRejectDictationTranscript('Thank you.', quietContext)).toBe(true)
    expect(shouldRejectDictationTranscript('Thanks for watching', quietContext)).toBe(true)

    const spokenContext = {
      speechDurationMs: 900,
      recordingDurationMs: 2400,
      audioBytes: 8000,
      language: 'en',
    }
    expect(shouldRejectDictationTranscript('Add milk to the shopping list', spokenContext)).toBe(
      false,
    )
  })

  it('accepts real transcripts when the mic monitor missed speech', () => {
    const missedMonitor = {
      speechDurationMs: 0,
      recordingDurationMs: 1200,
      audioBytes: 4000,
      language: 'en',
    }
    expect(shouldRejectDictationTranscript('Thank you.', missedMonitor)).toBe(true)
    expect(shouldRejectDictationTranscript('Add milk to the shopping list', missedMonitor)).toBe(
      false,
    )
  })
})
