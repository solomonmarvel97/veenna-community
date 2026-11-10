import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const analyserState = { amplitude: 0 }

function makeCtx() {
  return {
    state: 'running' as const,
    resume: () => Promise.resolve(),
    createAnalyser: () => ({
      fftSize: 2048,
      smoothingTimeConstant: 0.12,
      disconnect: () => {},
      getByteTimeDomainData: (out: Uint8Array) => {
        // Square wave at the requested amplitude around the 128 midpoint.
        for (let i = 0; i < out.length; i += 1) {
          out[i] = 128 + (i % 2 === 0 ? analyserState.amplitude : -analyserState.amplitude)
        }
      },
    }),
    createMediaStreamSource: () => ({ connect: () => {}, disconnect: () => {} }),
  }
}

vi.mock('@/lib/voice/dictationHudSounds', () => ({
  primeDictationHudSounds: () => {},
  getDictationHudAudioContext: () => makeCtx(),
}))

import { createMicLevelMonitor } from './micLevelMonitor'

describe('createMicLevelMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    analyserState.amplitude = 0
    // Simulate an unfocused / occluded window: rAF is registered but never fires.
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('detects speech and publishes levels even when rAF never fires', () => {
    const levels: number[] = []
    const monitor = createMicLevelMonitor({} as MediaStream, {
      onWaveLevel: (level) => levels.push(level),
    })

    analyserState.amplitude = 60 // loud, well clear of the speech gate
    vi.advanceTimersByTime(500)

    // Both barge-in inputs must be live: accumulated speech and a fresh level.
    expect(monitor.speechDurationMs()).toBeGreaterThan(0)
    expect(monitor.hadSpeechWithinMs(300)).toBe(true)
    expect(levels.some((level) => level > 0)).toBe(true)

    monitor.dispose()
  })

  it('reports no speech for a silent mic', () => {
    const monitor = createMicLevelMonitor({} as MediaStream, {})
    analyserState.amplitude = 0
    vi.advanceTimersByTime(500)
    expect(monitor.speechDurationMs()).toBe(0)
    monitor.dispose()
  })
})
