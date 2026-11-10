import { describe, expect, it } from 'vitest'
import { isMicPermissionError } from '@/lib/dictation/ensureDictationPermissions'

describe('isMicPermissionError', () => {
  it('detects DOM permission denials', () => {
    expect(
      isMicPermissionError(
        Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }),
      ),
    ).toBe(true)
    expect(
      isMicPermissionError(
        Object.assign(new Error('Permission denied'), { name: 'PermissionDeniedError' }),
      ),
    ).toBe(true)
  })

  it('detects MediaCaptureError mic_denied', () => {
    expect(
      isMicPermissionError(Object.assign(new Error('mic_denied'), { failure: 'mic_denied' })),
    ).toBe(true)
  })

  it('detects microphone copy from our own errors', () => {
    expect(isMicPermissionError(new Error('Microphone access was denied.'))).toBe(true)
    expect(
      isMicPermissionError(
        new Error(
          'Microphone is blocked. Turn it on in System Settings → Privacy & Security → Microphone.',
        ),
      ),
    ).toBe(true)
  })

  it('ignores unrelated failures', () => {
    expect(isMicPermissionError(new Error('Could not transcribe that. Please try again.'))).toBe(
      false,
    )
    expect(isMicPermissionError(new Error('Network Error'))).toBe(false)
    expect(isMicPermissionError(null)).toBe(false)
  })
})
