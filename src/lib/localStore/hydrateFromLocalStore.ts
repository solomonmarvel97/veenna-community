import { isElectron } from '@/lib/platform/isElectron'
import { useVoiceCapturesStore, type VoiceCapture } from '@/stores/voiceCaptures'
import { listLocalEntities } from '@/lib/localStore/localStoreClient'

function entityUpdatedAt(payload: Record<string, unknown>) {
  return String(
    payload.updated_at || payload.updatedAt || payload.createdAt || new Date().toISOString(),
  )
}

function wordCountOf(text: string): number {
  return text.split(' ').filter(Boolean).length
}

function normalizeVoiceCapture(payload: Record<string, unknown>): VoiceCapture | null {
  const id = String(payload.id ?? '').trim()
  const text = String(payload.text ?? '').trim()
  if (!id || !text) return null
  return {
    id,
    text,
    createdAt: String(payload.createdAt || entityUpdatedAt(payload)),
    wordCount: Number(payload.wordCount) || wordCountOf(text),
    durationMs: (payload.durationMs as number | null | undefined) ?? null,
    source: payload.source as VoiceCapture['source'],
    speechDurationMs: (payload.speechDurationMs as number | null | undefined) ?? null,
    hasAudio: Boolean(payload.hasAudio),
    originDeviceId: (payload.originDeviceId as string | null | undefined) ?? null,
    ...(typeof payload.updatedAt === 'string' ? { updatedAt: payload.updatedAt } : {}),
  }
}

/** Loads the dictations saved in the on-device database into the captures store. */
export async function hydrateStoresFromLocalStore(): Promise<{ ok: boolean; entityCount: number }> {
  if (!isElectron) return { ok: false, entityCount: 0 }

  const result = await listLocalEntities({ types: ['voice_capture'] })
  if (!result.ok || !result.entities?.length) {
    return { ok: result.ok, entityCount: 0 }
  }

  const captures = result.entities
    .map((entity) => (entity.payload ? normalizeVoiceCapture(entity.payload) : null))
    .filter(Boolean) as VoiceCapture[]
  if (captures.length) {
    useVoiceCapturesStore().applySqliteHydration(captures)
  }
  return { ok: true, entityCount: result.entities.length }
}
