import type { MicLevelMonitor } from '@/lib/dictation/whisperTranscript'
import { MIC_WAVE_IDLE_LEVEL, createMicWaveNormalizer } from '@/lib/dictation/dictationMicLevel'
import { createMicSpeechDetector } from '@/lib/dictation/micSpeechDetector'
import {
  getDictationHudAudioContext,
  primeDictationHudSounds,
} from '@/lib/voice/dictationHudSounds'

const SPEECH_SAMPLE_INTERVAL_MS = 80
/**
 * Typing tests keep the clock running through hesitations; voice should too.
 * A pause longer than this (thinking, looking something up) only counts up to
 * the cap, the way a typist stepping away would not be timed for the break.
 */
const SPEAKING_PAUSE_CAP_MS = 2000

let bargeInGuard = false

function emptyMicLevelMonitor(): MicLevelMonitor {
  return {
    hadSpeechWithinMs: () => false,
    speechDurationMs: () => 0,
    speakingMs: () => 0,
    sampledFrameCount: () => 0,
    resetSpeech: () => {},
    dispose: () => {},
  }
}

export type MicLevelMonitorOptions = {
  /** Push normalized HUD waveform samples (same stream as speech detection). */
  onWaveLevel?: (level: number) => void
}

/** Mic level monitor with AudioContext resume (required in Electron HUD on macOS). */
export function createMicLevelMonitor(
  stream: MediaStream,
  options: MicLevelMonitorOptions = {},
): MicLevelMonitor {
  try {
    primeDictationHudSounds()
    const ctx = getDictationHudAudioContext()
    if (!ctx) return emptyMicLevelMonitor()
    const liveCtx = ctx
    void ctx.resume().catch(() => {})

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.12
    const source = ctx.createMediaStreamSource(stream)
    source.connect(analyser)

    const waveNormalizer = createMicWaveNormalizer()
    const speechDetector = createMicSpeechDetector()
    speechDetector.setBargeIn(bargeInGuard)
    let lastSpeechAt = 0
    let accumulatedSpeechMs = 0
    // Pause since the last voiced frame; only added once speech resumes, so
    // lead-in and trailing silence never count.
    let speakingMs = 0
    let pendingPauseMs = 0
    let sampledFrames = 0
    let lastRms = 0
    let waveRaf = 0
    const timeDomain = new Uint8Array(analyser.fftSize) as Uint8Array<ArrayBuffer>

    function resetSpeech() {
      lastSpeechAt = 0
      accumulatedSpeechMs = 0
      speakingMs = 0
      pendingPauseMs = 0
      // Keep the learned noise floor so room hiss does not become a new turn.
    }

    function readRms(): number {
      analyser.getByteTimeDomainData(timeDomain)
      let sum = 0
      for (let i = 0; i < timeDomain.length; i += 1) {
        const v = (timeDomain[i]! - 128) / 128
        sum += v * v
      }
      return Math.sqrt(sum / timeDomain.length)
    }

    // Visual smoothing only. requestAnimationFrame is throttled - often stopped
    // outright - while the window is unfocused or occluded, which is exactly
    // when the user talks over Veenna. Speech detection must never depend on it.
    function pumpWave() {
      if (liveCtx.state === 'suspended') {
        void liveCtx.resume().catch(() => {})
      } else if (liveCtx.state === 'running') {
        options.onWaveLevel?.(waveNormalizer.sample(readRms()))
      }
      waveRaf = requestAnimationFrame(pumpWave)
    }

    // Authoritative sampler: the AnalyserNode keeps running when rAF does not,
    // so read the mic here and publish the level from here too. Barge-in needs
    // both a fresh RMS and a fresh wave level to fire at all.
    const timer = setInterval(() => {
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
      if (ctx.state !== 'running') return
      sampledFrames += 1
      lastRms = readRms()
      options.onWaveLevel?.(waveNormalizer.sample(lastRms))
      speechDetector.setBargeIn(bargeInGuard)
      if (speechDetector.isSpeech(lastRms)) {
        if (accumulatedSpeechMs > 0) speakingMs += Math.min(pendingPauseMs, SPEAKING_PAUSE_CAP_MS)
        pendingPauseMs = 0
        lastSpeechAt = Date.now()
        accumulatedSpeechMs += SPEECH_SAMPLE_INTERVAL_MS
        speakingMs += SPEECH_SAMPLE_INTERVAL_MS
      } else {
        pendingPauseMs += SPEECH_SAMPLE_INTERVAL_MS
      }
    }, SPEECH_SAMPLE_INTERVAL_MS)

    options.onWaveLevel?.(MIC_WAVE_IDLE_LEVEL)
    waveRaf = requestAnimationFrame(pumpWave)

    return {
      hadSpeechWithinMs(windowMs: number) {
        if (!lastSpeechAt) return false
        return Date.now() - lastSpeechAt <= windowMs
      },
      speechDurationMs() {
        return accumulatedSpeechMs
      },
      speakingMs() {
        return speakingMs
      },
      sampledFrameCount() {
        return sampledFrames
      },
      resetSpeech,
      dispose() {
        bargeInGuard = false
        cancelAnimationFrame(waveRaf)
        waveRaf = 0
        clearInterval(timer)
        source.disconnect()
        analyser.disconnect()
        waveNormalizer.reset()
        speechDetector.reset()
      },
    }
  } catch {
    return emptyMicLevelMonitor()
  }
}
