import type { DictationForegroundContext } from '@/lib/dictation/appContext'
import type { DictationSilenceContext } from '@/lib/dictation/dictationSilence'

export type { DictationSilenceContext }

type DictationRetryStage = 'audio' | 'transcript'

export type DictationRetryPayload = {
  stage: DictationRetryStage
  blob: Blob | null
  systemBlob: Blob | null
  mixedBlob: Blob | null
  rawText?: string
  durationMs: number | null
  formatOn: boolean
  capturedAppContext: DictationForegroundContext | null
  silenceContext: DictationSilenceContext
  /** Stable Voice history row for this recording across retries. */
  captureId?: string
}

let retryPayload: DictationRetryPayload | null = null

export function hasDictationRetry(): boolean {
  return retryPayload !== null
}

export function getDictationRetry(): DictationRetryPayload | null {
  return retryPayload
}

export function saveDictationRetry(payload: DictationRetryPayload) {
  retryPayload = payload
}

export function patchDictationRetry(patch: Partial<DictationRetryPayload>) {
  if (!retryPayload) return
  retryPayload = { ...retryPayload, ...patch }
}

export function clearDictationRetry() {
  retryPayload = null
}
