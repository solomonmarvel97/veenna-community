import type { VoiceInsightsSummary } from '@/types/insights'
import type { CaptureChannel } from '@/lib/sync/captureChannel'

/** The shapes the dictation history is built from. */

export type VoiceCapture = {
  id: string
  text: string
  createdAt: string
  updatedAt?: string
  wordCount: number
  durationMs?: number | null
  /**
   * Cumulative voiced-audio time from the mic analyser, in ms. Unlike
   * `durationMs` (wall-clock mic-open to mic-close), this excludes silence
   * and thinking pauses, so it is the right denominator for words-per-minute.
   * Null for older captures and any flow without a mic monitor (e.g. mobile
   * sync) - those fall back to `durationMs`.
   */
  speechDurationMs?: number | null
  source?: 'dictation' | 'hotkey' | 'manual'
  /** True when local playback audio is stored for this capture. */
  hasAudio?: boolean
  /** Install that recorded this capture (stable per browser/app profile). */
  originDeviceId?: string | null
  /** Surface that recorded it, so other devices can say where the audio lives. */
  originChannel?: CaptureChannel | null
}

type VoiceCaptureGroupPeriod = 'today' | 'yesterday' | 'history'

export type VoiceCaptureGroup = {
  label: string
  period: VoiceCaptureGroupPeriod
  items: VoiceCapture[]
}

export type VoiceCapturesHistoryPage = {
  items: VoiceCapture[]
  total: number
  page: number
  pageSize: number
  query: string
  loading: boolean
  loaded: boolean
}

export type VoiceCapturesCache = {
  captures: VoiceCapture[]
  insights: VoiceInsightsSummary | null
  updatedAt: string
}
