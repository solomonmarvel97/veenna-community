import type { useDictationStore } from '@/stores/dictation'
import { readPreferredMicDeviceId } from '@/lib/voice/dictationMicPreference'
import { dictationEngine, disposeMicMonitor, RECORDER_AUDIO_BITS_PER_SECOND, clearWarmMicTimer } from '@/lib/dictation/dictationEngine'
import { createMicLevelMonitor } from '@/lib/dictation/micLevelMonitor'
import { isMicPermissionError, recoverDictationMicPermission } from '@/lib/dictation/ensureDictationPermissions'

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return MIME_CANDIDATES.find((mime) => MediaRecorder.isTypeSupported(mime))
}


/**
 * Opening, reusing and releasing the microphone, and building the MediaRecorder on it.
 * The stream itself lives on `dictationEngine` so it survives between recordings (a warm mic
 * starts the next one instantly); `store` is told about the audio track and the wave level.
 */
export function createMicControls(store: ReturnType<typeof useDictationStore>) {
  function releaseMic(force = false) {
    if (!force && dictationEngine.warmMicTimer) return
    clearWarmMicTimer()
    disposeMicMonitor()
    store.setAudioTrack(null)
    store.setMicWaveLevel(null)
    dictationEngine.stream?.getTracks().forEach((track) => track.stop())
    dictationEngine.stream = null
  }

  async function ensureMic(): Promise<MediaStream> {
    clearWarmMicTimer()
    const deviceId = readPreferredMicDeviceId()
    const existing = dictationEngine.stream
    if (existing) {
      const track = existing.getAudioTracks()[0]
      // A warm mic is reused unless the owner picked a different one meanwhile.
      const sameDevice = !deviceId || track?.getSettings().deviceId === deviceId
      if (track && track.readyState === 'live' && sameDevice) return existing
      releaseMic(true)
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access is not available in this browser.')
    }
    // Ask macOS / the browser before getUserMedia when Microphone is not yet granted,
    // so a missing permission becomes a system prompt instead of a later STT failure.
    // Once the mic has opened fine, skip this round trip; a failure below still checks.
    if (!dictationEngine.micOpenedOk) {
      const permission = await recoverDictationMicPermission()
      if (permission?.needsPermission && permission.status !== 'not-determined') {
        throw new Error(permission.message)
      }
    }
    const openMic = async (constraints: MediaStreamConstraints) => {
      const opened = await navigator.mediaDevices.getUserMedia(constraints)
      // A second press can race this open; keep one stream so the other never stays live unowned.
      const current = dictationEngine.stream
      if (!current) return opened
      opened.getTracks().forEach((track) => track.stop())
      return current
    }
    try {
      dictationEngine.stream = await openMic({
        audio: deviceId ? { deviceId: { ideal: deviceId } } : true,
      })
    } catch (err) {
      dictationEngine.micOpenedOk = false
      if (isMicPermissionError(err)) {
        const recovery = await recoverDictationMicPermission(err)
        throw new Error(recovery?.message || 'Microphone access was denied.')
      }
      if (!deviceId) throw err
      try {
        dictationEngine.stream = await openMic({ audio: true })
      } catch (fallbackErr) {
        if (isMicPermissionError(fallbackErr)) {
          const recovery = await recoverDictationMicPermission(fallbackErr)
          throw new Error(recovery?.message || 'Microphone access was denied.')
        }
        throw fallbackErr
      }
    }
    dictationEngine.micOpenedOk = true
    return dictationEngine.stream
  }

  function attachMicMonitor(media: MediaStream) {
    disposeMicMonitor()
    store.setMicWaveLevel(null)
    dictationEngine.micMonitor = createMicLevelMonitor(media, {
      onWaveLevel: (level) => store.setMicWaveLevel(level),
    })
  }

  function createMediaRecorder(stream: MediaStream): MediaRecorder {
    const mimeType = pickMimeType()
    const recorderOptions: MediaRecorderOptions = {
      audioBitsPerSecond: RECORDER_AUDIO_BITS_PER_SECOND,
    }
    if (mimeType) recorderOptions.mimeType = mimeType
    try {
      return new MediaRecorder(stream, recorderOptions)
    } catch {
      return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    }
  }

  return { releaseMic, ensureMic, attachMicMonitor, createMediaRecorder }
}
