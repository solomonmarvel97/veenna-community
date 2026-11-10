import type { VoiceInsightsSummary } from '@/types/insights'
import { isElectron } from '@/lib/platform/isElectron'
import { normalizeCapture } from './normalizeCapture'
import type { VoiceCapture, VoiceCapturesCache } from './types'

/** The browser's copy of the history. The desktop app keeps it in the local database instead. */

const STORAGE_KEY = 'veenna-voice-captures'

export function readCache(): VoiceCapturesCache {
  if (isElectron) {
    return { captures: [], insights: null, updatedAt: '' }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { captures: [], insights: null, updatedAt: '' }
    const parsed = JSON.parse(raw) as unknown

    // Legacy: bare capture array
    if (Array.isArray(parsed)) {
      return {
        captures: parsed.map(normalizeCapture).filter(Boolean) as VoiceCapture[],
        insights: null,
        updatedAt: '',
      }
    }

    if (parsed && typeof parsed === 'object') {
      const cache = parsed as Partial<VoiceCapturesCache>
      const captures = Array.isArray(cache.captures)
        ? (cache.captures.map(normalizeCapture).filter(Boolean) as VoiceCapture[])
        : []
      const insights = cache.insights && typeof cache.insights === 'object' ? cache.insights : null
      return {
        captures,
        insights,
        updatedAt: typeof cache.updatedAt === 'string' ? cache.updatedAt : '',
      }
    }
  } catch {
    /* ignore corrupt cache */
  }
  return { captures: [], insights: null, updatedAt: '' }
}

export function writeCache(captures: VoiceCapture[], insights: VoiceInsightsSummary | null) {
  if (isElectron) return
  const payload: VoiceCapturesCache = {
    captures,
    insights,
    updatedAt: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}
