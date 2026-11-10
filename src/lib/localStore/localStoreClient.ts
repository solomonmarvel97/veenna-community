import { isElectron } from '@/lib/platform/isElectron'
import type {
  LocalStoreEntityType,
  LocalStoreListEntitiesPayload,
  LocalStoreListEntitiesResult,
} from '@/types/electron'
import {
  scheduleLocalMirrorDelete,
  scheduleLocalMirrorUpsert,
} from '@/lib/localStore/localMirrorBus'
import { toPlainIpcValue } from '@/lib/localStore/toPlainIpcValue'

function api() {
  return typeof window !== 'undefined' ? window.veennaElectron : undefined
}

export { toPlainIpcValue } from '@/lib/localStore/toPlainIpcValue'

export async function openLocalStore(userId: string) {
  if (!isElectron || !userId.trim()) return { ok: false as const, reason: 'unavailable' }
  try {
    return (
      (await api()?.openLocalStore?.(userId.trim())) ?? {
        ok: false as const,
        reason: 'unavailable',
      }
    )
  } catch {
    return { ok: false as const, reason: 'unavailable' }
  }
}

export async function listLocalEntities(
  payload: LocalStoreListEntitiesPayload = {},
): Promise<LocalStoreListEntitiesResult> {
  if (!isElectron) return { ok: false, reason: 'unavailable' }
  try {
    const plain = toPlainIpcValue(payload)
    if (!plain) return { ok: false, reason: 'unavailable' }
    return (
      (await api()?.listLocalEntities?.(plain)) ?? {
        ok: false,
        reason: 'unavailable',
      }
    )
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}

export function mirrorLocalEntity(
  type: LocalStoreEntityType,
  id: string,
  payload: Record<string, unknown>,
  updatedAt?: string,
) {
  scheduleLocalMirrorUpsert(type, id, payload, updatedAt)
}


export function removeLocalEntity(type: LocalStoreEntityType, id: string) {
  scheduleLocalMirrorDelete(type, id)
}

export async function getLocalAppSetting(key: string): Promise<unknown | null> {
  if (!isElectron || !key.trim()) return null
  try {
    const result = await api()?.getLocalAppSetting?.(key.trim())
    if (!result?.ok) return null
    return result.value ?? null
  } catch {
    return null
  }
}

export async function setLocalAppSetting(key: string, value: unknown): Promise<boolean> {
  if (!isElectron || !key.trim()) return false
  try {
    const plain = toPlainIpcValue(value)
    if (plain === null && value !== null) return false
    const result = await api()?.setLocalAppSetting?.(key.trim(), plain)
    return result?.ok === true
  } catch {
    return false
  }
}
