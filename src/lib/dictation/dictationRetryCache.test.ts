import { describe, expect, it, beforeEach } from 'vitest'
import {
  clearDictationRetry,
  getDictationRetry,
  hasDictationRetry,
  patchDictationRetry,
  saveDictationRetry,
} from '@/lib/dictation/dictationRetryCache'

describe('dictationRetryCache', () => {
  beforeEach(() => {
    clearDictationRetry()
  })

  it('starts empty', () => {
    expect(hasDictationRetry()).toBe(false)
    expect(getDictationRetry()).toBeNull()
  })

  it('stores and retrieves retry payload', () => {
    saveDictationRetry({
      stage: 'audio',
      blob: new Blob(['a']),
      systemBlob: null,
      mixedBlob: null,
      durationMs: 1200,
      formatOn: true,
      capturedAppContext: null,
      silenceContext: {
        speechDurationMs: 900,
        recordingDurationMs: 1200,
        audioBytes: 4,
        language: 'en',
      },
    })

    expect(hasDictationRetry()).toBe(true)
    expect(getDictationRetry()?.stage).toBeDefined()
  })

  it('patches transcript stage for faster retry', () => {
    saveDictationRetry({
      stage: 'audio',
      blob: new Blob(['a']),
      systemBlob: null,
      mixedBlob: null,
      durationMs: 500,
      formatOn: false,
      capturedAppContext: null,
      silenceContext: {
        speechDurationMs: 400,
        recordingDurationMs: 500,
        audioBytes: 4,
        language: 'en',
      },
    })

    patchDictationRetry({ stage: 'transcript', rawText: 'Hello world' })

    expect(getDictationRetry()?.stage).toBe('transcript')
    expect(getDictationRetry()?.rawText).toBe('Hello world')
  })

  it('keeps a stable capture id across retry patches', () => {
    saveDictationRetry({
      stage: 'audio',
      blob: new Blob(['a']),
      systemBlob: null,
      mixedBlob: null,
      durationMs: 500,
      formatOn: false,
      capturedAppContext: null,
      captureId: '11111111-1111-4111-8111-111111111111',
      silenceContext: {
        speechDurationMs: 400,
        recordingDurationMs: 500,
        audioBytes: 4,
        language: 'en',
      },
    })

    patchDictationRetry({ stage: 'transcript', rawText: 'Hello world' })

    expect(getDictationRetry()?.captureId).toBe('11111111-1111-4111-8111-111111111111')
  })

  it('clears on dismiss', () => {
    saveDictationRetry({
      stage: 'audio',
      blob: null,
      systemBlob: null,
      mixedBlob: null,
      durationMs: null,
      formatOn: true,
      capturedAppContext: null,
      silenceContext: {
        speechDurationMs: 0,
        recordingDurationMs: 0,
        audioBytes: 0,
        language: 'en',
      },
    })

    clearDictationRetry()
    expect(hasDictationRetry()).toBe(false)
  })
})
