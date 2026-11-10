import type { MicLevelMonitor } from '@/lib/dictation/whisperTranscript'
import { isLikelySilentWhisperTranscript } from '@/lib/dictation/whisperTranscript'

/** Minimum cumulative voiced audio before we call STT. */
export const MIN_DICTATION_SPEECH_MS = 400

/** Key held long enough to trust the recorder when the mic monitor missed speech. */
export const MIN_DICTATION_HOLD_MS = 600

/** Tiny / empty blobs are usually silence or a missed release. */
export const MIN_DICTATION_AUDIO_BYTES = 1800

/** Accidental HUD taps are typically 1–2s; a recording shorter than this is not kept as a placeholder. */
export const MIN_PLACEHOLDER_DURATION_MS = 3_000

/** ~240ms of running analyser frames - enough to trust silence vs a suspended context. */
const MIN_DICTATION_SAMPLED_FRAMES = 3

export type DictationSilenceContext = {
  speechDurationMs: number
  /** Typing-test-style speaking time for wpm (see MicLevelMonitor.speakingMs). */
  speakingMs?: number
  recordingDurationMs: number
  audioBytes: number
  language: string
  /**
   * True when the HUD mic analyser ran while AudioContext was running.
   * When false/omitted, a long hold may still be transcribed (suspended-context fallback).
   */
  monitorSampled?: boolean
}

export function readSpeechDurationMs(monitor: MicLevelMonitor | null): number {
  return monitor?.speechDurationMs?.() ?? 0
}

export function readSpeakingMs(monitor: MicLevelMonitor | null): number {
  return monitor?.speakingMs?.() ?? 0
}

export function readMonitorSampled(monitor: MicLevelMonitor | null): boolean {
  return (monitor?.sampledFrameCount?.() ?? 0) >= MIN_DICTATION_SAMPLED_FRAMES
}

/**
 * Electron HUD AudioContext can stay suspended so speechDurationMs stays 0 despite real audio.
 * Only use this fallback when the analyser never sampled a running context - a long silent
 * hold still produces a large MediaRecorder blob, which is not evidence of speech.
 */
function micMonitorMissedSpeech(context: DictationSilenceContext): boolean {
  if (context.monitorSampled) return false
  return (
    context.speechDurationMs < MIN_DICTATION_SPEECH_MS &&
    context.recordingDurationMs >= MIN_DICTATION_HOLD_MS &&
    context.audioBytes >= MIN_DICTATION_AUDIO_BYTES
  )
}

/** Skip STT entirely when the mic never picked up enough speech. */
export function shouldSkipDictationTranscription(context: DictationSilenceContext): boolean {
  if (context.audioBytes < MIN_DICTATION_AUDIO_BYTES) return true
  if (context.recordingDurationMs < 250) return true
  if (micMonitorMissedSpeech(context)) return false
  if (context.speechDurationMs < MIN_DICTATION_SPEECH_MS) return true
  return false
}

/** Reject phantom STT output after transcription. */
export function shouldRejectDictationTranscript(
  text: string,
  context: DictationSilenceContext,
  options?: { minSpeechMs?: number },
): boolean {
  const monitorMissed = micMonitorMissedSpeech(context)
  const minSpeechMs = options?.minSpeechMs ?? MIN_DICTATION_SPEECH_MS
  return isLikelySilentWhisperTranscript(text, context.language, {
    speechDurationMs: monitorMissed ? null : context.speechDurationMs,
    recordingDurationMs: context.recordingDurationMs,
    minSpeechMs,
  })
}
