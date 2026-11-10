import { getCaptureAudio, hasCaptureAudio } from '@/lib/voice/captureAudioStore'
import type { VoiceCapture } from '@/stores/voiceCaptures'

/** Recordings live on this device only: a dictation is playable when its audio was saved here. */
export function captureHasPlayableAudio(capture: VoiceCapture): boolean {
  return Boolean(capture.hasAudio)
}

/** Where a failed play attempt stopped, so the toast can say what to do. */
export class CaptureAudioDownloadError extends Error {
  constructor() {
    super('Could not read the recording')
    this.name = 'CaptureAudioDownloadError'
  }
}

/** The saved recording for a dictation, or null when there is none. */
export async function ensureCaptureAudioLocal(capture: VoiceCapture): Promise<Blob | null> {
  if (!capture?.id) return null
  if (!(await hasCaptureAudio(capture.id))) return null
  return getCaptureAudio(capture.id)
}
