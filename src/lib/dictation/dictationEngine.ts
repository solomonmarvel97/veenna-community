/** Shared dictation runtime state - one mic/recorder across hotkey + FAB composables. */

import type { MicLevelMonitor } from '@/lib/dictation/whisperTranscript'
import type { DictationForegroundContext } from '@/lib/dictation/appContext'
import type { DictationInsertTarget } from '@/lib/dictation/insertAtCursor'
import type { DictationForegroundSnapshot } from '@/types/electron'
import type { LiveSegments } from '@/lib/dictation/liveSegments'

/**
 * How long the mic stays open after a session, so the next press within it starts
 * recording at once instead of opening the device again (slow, worst on Bluetooth).
 * The system mic indicator stays on for this window.
 */
const MIC_WARM_MS = 45_000
export const RECORDER_TIMESLICE_MS = 100
/** Speech-optimized Opus bitrate - smaller uploads, faster Whisper. */
export const RECORDER_AUDIO_BITS_PER_SECOND = 24_000
/** Max continuous dictation length (UI auto-stop + backend transcription guard). */
const DICTATION_MAX_DURATION_SECONDS = 60 * 60
const DICTATION_MAX_DURATION_MS = DICTATION_MAX_DURATION_SECONDS * 1000

export type DictationEngineState = {
  stream: MediaStream | null
  recorder: MediaRecorder | null
  chunks: Blob[]
  systemRecorder: MediaRecorder | null
  systemChunks: Blob[]
  mixedRecorder: MediaRecorder | null
  mixedChunks: Blob[]
  startedAt: number
  abortController: AbortController | null
  warmMicTimer: ReturnType<typeof setTimeout> | null
  /** Auto-stop for the running session. On the engine so any composable instance can clear it. */
  maxDurationTimer: ReturnType<typeof setTimeout> | null
  /** Delayed HUD reset after a session ends; a new session must cancel it. */
  hudResetTimer: ReturnType<typeof setTimeout> | null
  /** The mic has opened fine in this window: later presses skip the permission pre-check. */
  micOpenedOk: boolean
  sttPrompt: string | undefined
  prewarmAttempted: boolean
  micMonitor: MicLevelMonitor | null
  finalizing: boolean
  capturedAppContext: DictationForegroundContext | null
  /** Session whose background foreground-app lookup may still fill capturedAppContext. */
  appContextLookupToken: number
  /** Editable field snapshotted when recording started (mic-button focus steal). */
  capturedInsertTarget: DictationInsertTarget | null
  /** Whether a text field had focus when recording started (OS AX or in-app DOM). */
  hadTextInputFocusAtCapture: boolean
  /** OS foreground app snapshotted on hotkey release, before HUD processing steals focus. */
  foregroundAtRecordingEnd: DictationForegroundSnapshot | null
  /**
   * Session generation counter. startRecording captures the token at entry and re-checks it
   * after every await - finalize/cancel bump it, so a quick key release mid-startup can't leave
   * an orphaned mic/recorder running after the session was already dismissed.
   */
  startToken: number
  /** In-flight Compose run the next session may take the HUD from (see useDictation). */
  detachableJob: DictationProcessingJob | null
  /** Transcribing while speaking; ends with the session that started it. */
  liveSegments: LiveSegments | null
  /** Where the first words say the speech should go, asked while the rest is still being said. */
}

/** What paste delivery needs from the session that recorded the text. */
export type DictationDeliverySnapshot = Pick<
  DictationEngineState,
  | 'capturedAppContext'
  | 'capturedInsertTarget'
  | 'hadTextInputFocusAtCapture'
  | 'foregroundAtRecordingEnd'
>

/**
 * One processing run. A detached run has handed the HUD to a newer session and
 * finishes (generate, paste, save) in the background from its own snapshot.
 */
type DictationProcessingJob = {
  detached: boolean
  /** The run's recording, lent back to the capture store when it saves. */
  audio: Blob | null
  /** Taken when the run becomes detachable; null means read the live engine fields. */
  delivery: DictationDeliverySnapshot | null
}

export const dictationEngine: DictationEngineState = {
  stream: null,
  recorder: null,
  chunks: [],
  systemRecorder: null,
  systemChunks: [],
  mixedRecorder: null,
  mixedChunks: [],
  startedAt: 0,
  abortController: null,
  warmMicTimer: null,
  maxDurationTimer: null,
  hudResetTimer: null,
  micOpenedOk: false,
  sttPrompt: undefined,
  prewarmAttempted: false,
  micMonitor: null,
  finalizing: false,
  capturedAppContext: null,
  appContextLookupToken: 0,
  capturedInsertTarget: null,
  hadTextInputFocusAtCapture: false,
  foregroundAtRecordingEnd: null,
  startToken: 0,
  detachableJob: null,
  liveSegments: null,
}

/** Processing blocks a new session unless the in-flight run can be detached. */
export function processingBlocksNewSession(mode: string): boolean {
  return mode === 'processing' && !dictationEngine.detachableJob
}

/** Finalizing blocks a new session unless the in-flight run can be detached. */
export function finalizingBlocksNewSession(): boolean {
  return dictationEngine.finalizing && !dictationEngine.detachableJob
}

export function disposeMicMonitor() {
  dictationEngine.micMonitor?.dispose()
  dictationEngine.micMonitor = null
}

export function clearWarmMicTimer() {
  if (dictationEngine.warmMicTimer) {
    clearTimeout(dictationEngine.warmMicTimer)
    dictationEngine.warmMicTimer = null
  }
}

/** Keep the mic open for MIC_WARM_MS after a session, then release it; the next session cancels the release. */
export function scheduleWarmMicRelease(onRelease: () => void) {
  clearWarmMicTimer()
  if (MIC_WARM_MS <= 0) {
    onRelease()
    return
  }
  dictationEngine.warmMicTimer = setTimeout(() => {
    dictationEngine.warmMicTimer = null
    if (!isCaptureLive()) onRelease()
  }, MIC_WARM_MS)
}

export function clearMaxDurationTimer() {
  if (dictationEngine.maxDurationTimer) {
    clearTimeout(dictationEngine.maxDurationTimer)
    dictationEngine.maxDurationTimer = null
  }
}

/** Auto-stop the running session at the cap, whichever composable instance started it. */
export function armMaxDurationTimer(onExpire: () => void) {
  clearMaxDurationTimer()
  dictationEngine.maxDurationTimer = setTimeout(() => {
    dictationEngine.maxDurationTimer = null
    onExpire()
  }, DICTATION_MAX_DURATION_MS)
}

export function clearHudResetTimer() {
  if (dictationEngine.hudResetTimer) {
    clearTimeout(dictationEngine.hudResetTimer)
    dictationEngine.hudResetTimer = null
  }
}

/** Reset the HUD after a session's last frame; the next session cancels it (see clearHudResetTimer). */
export function scheduleHudReset(onReset: () => void, delayMs: number) {
  clearHudResetTimer()
  dictationEngine.hudResetTimer = setTimeout(() => {
    dictationEngine.hudResetTimer = null
    onReset()
  }, delayMs)
}

/**
 * How long the current session has recorded; null until audio starts. Wall-clock time
 * keeps running while the Mac sleeps, so it is held at the cap.
 */
export function recordingElapsedMs(now = Date.now()): number | null {
  if (!dictationEngine.startedAt) return null
  return Math.min(now - dictationEngine.startedAt, DICTATION_MAX_DURATION_MS)
}

/** A recorder is running or paused. While true, only stopping it may end the session. */
export function isCaptureLive(): boolean {
  return [
    dictationEngine.recorder,
    dictationEngine.systemRecorder,
    dictationEngine.mixedRecorder,
  ].some((recorder) => Boolean(recorder) && recorder?.state !== 'inactive')
}

/** Stop and drop recorders no session owns. Returns whether any was still running. */
export function discardStrayRecorders(): boolean {
  dictationEngine.liveSegments?.cancel()
  dictationEngine.liveSegments = null
  let found = false
  for (const recorder of [
    dictationEngine.recorder,
    dictationEngine.systemRecorder,
    dictationEngine.mixedRecorder,
  ]) {
    if (!recorder || recorder.state === 'inactive') continue
    found = true
    recorder.ondataavailable = null
    recorder.onstop = null
    try {
      recorder.stop()
    } catch {
      /* already stopping */
    }
  }
  dictationEngine.recorder = null
  dictationEngine.systemRecorder = null
  dictationEngine.mixedRecorder = null
  dictationEngine.chunks = []
  dictationEngine.systemChunks = []
  dictationEngine.mixedChunks = []
  return found
}

/** A still-open mic from the last session the next one can record on straight away. */
export function isMicWarm(): boolean {
  const track = dictationEngine.stream?.getAudioTracks()[0]
  return Boolean(track && track.readyState === 'live')
}

/**
 * No-op. The mic opens when dictation starts and stays warm for MIC_WARM_MS after
 * it ends (see scheduleWarmMicRelease); it is never opened ahead of a first press.
 */
export async function prewarmMicrophone(): Promise<void> {
  return
}
