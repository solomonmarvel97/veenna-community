import { getVeennaElectron } from '@/lib/platform/isElectron'
import { toPlainIpcValue } from '@/lib/localStore/toPlainIpcValue'
import type { VoiceCapture } from '@/stores/voiceCaptures'

export type VoiceDataChangedPayload = {
  /** Optimistic capture for other Electron windows (main homepage feed). */
  capture?: VoiceCapture
  /** HUD is persisting local playback audio for this capture id. */
  audioSaving?: boolean
  audioCaptureId?: string
}

/** Tell other Electron windows (and this window) to pull fresh captures. */
export function notifyVoiceDataChanged(payload: VoiceDataChangedPayload = {}) {
  const plain = toPlainIpcValue(payload) ?? {}
  void getVeennaElectron()?.notifyVoiceDataChanged?.(plain)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('veenna-voice-data-changed', { detail: plain }))
  }
}
