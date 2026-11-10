import { normalizeCaptureChannel } from '@/lib/sync/captureChannel'
import { countWords } from './captureStats'
import type { VoiceCapture } from './types'

/** Turn whatever was stored into a well-formed capture, or null if it is not one. */

export function normalizeCapture(item: unknown): VoiceCapture | null {
  if (!item || typeof item !== 'object') return null
  const row = item as Partial<VoiceCapture>
  if (!row.id || !row.text) return null
  return {
    id: String(row.id),
    text: String(row.text),
    createdAt: String(row.createdAt || new Date().toISOString()),
    wordCount: Number(row.wordCount) || countWords(String(row.text)),
    durationMs: row.durationMs ?? null,
    speechDurationMs: row.speechDurationMs ?? null,
    source: row.source,
    hasAudio: Boolean(row.hasAudio),
    originDeviceId: row.originDeviceId ?? null,
    originChannel: normalizeCaptureChannel(row.originChannel),
  }
}
