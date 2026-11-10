import { describe, expect, it } from 'vitest'
import { createMicSpeechDetector } from './micSpeechDetector'

describe('createMicSpeechDetector', () => {
  it('treats energy at the waveform gate as speech in a quiet room', () => {
    const detector = createMicSpeechDetector()
    expect(detector.isSpeech(0.02)).toBe(true)
  })

  it('learns room noise and then ignores it', () => {
    const detector = createMicSpeechDetector()
    for (let i = 0; i < 80; i += 1) detector.isSpeech(0.012)
    expect(detector.isSpeech(0.012)).toBe(false)
    expect(detector.isSpeech(0.08)).toBe(true)
  })

  it('raises the gate in barge-in mode so echo is not speech', () => {
    const detector = createMicSpeechDetector()
    detector.setBargeIn(true)
    expect(detector.isSpeech(0.014)).toBe(false)
    expect(detector.isSpeech(0.025)).toBe(true)
    expect(detector.isSpeech(0.08)).toBe(true)
  })

  it('does not ratchet the gate up while Veenna speaks', () => {
    const detector = createMicSpeechDetector()
    detector.setBargeIn(true)
    // Sustained speaker echo just under the gate must not raise the floor,
    // otherwise the user can never break in through their own mic.
    for (let i = 0; i < 200; i += 1) detector.isSpeech(0.019)
    expect(detector.isSpeech(0.025)).toBe(true)
  })

  it('lets a floor learned just before playback fall back down', () => {
    const detector = createMicSpeechDetector()
    // Floor learned high off the tail of the user's own speech.
    for (let i = 0; i < 200; i += 1) detector.isSpeech(0.03)
    detector.setBargeIn(true)
    for (let i = 0; i < 400; i += 1) detector.isSpeech(0.005)
    expect(detector.isSpeech(0.025)).toBe(true)
  })

  it('still learns the room floor once Veenna stops speaking', () => {
    const detector = createMicSpeechDetector()
    detector.setBargeIn(true)
    for (let i = 0; i < 200; i += 1) detector.isSpeech(0.019)
    detector.setBargeIn(false)
    for (let i = 0; i < 200; i += 1) detector.isSpeech(0.012)
    expect(detector.isSpeech(0.012)).toBe(false)
  })
})
