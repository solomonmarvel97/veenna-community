import { isElectron } from '@/lib/platform/isElectron'
import type { LocalStoreEntityType } from '@/types/electron'
import { searchTextForVoiceCapture } from '@/lib/localStore/searchText'
import { toPlainIpcValue } from '@/lib/localStore/toPlainIpcValue'

const DEBOUNCE_MS = 32

type MirrorOp = 'upsert' | 'delete'

type PendingMirror = {
  type: LocalStoreEntityType
  id: string
  payload?: Record<string, unknown>
  updatedAt?: string
  op: MirrorOp
}

const pending = new Map<string, PendingMirror>()
let flushTimer: ReturnType<typeof setTimeout> | null = null

function api() {
  return typeof window !== 'undefined' ? window.veennaElectron : undefined
}

function jobKey(type: LocalStoreEntityType, id: string): string {
  return `${type}:${id}`
}

async function safeUpsert(payload: {
  type: LocalStoreEntityType
  id: string
  payload: Record<string, unknown>
  searchText: string
  updatedAt: string
}) {
  const plain = toPlainIpcValue(payload)
  if (!plain) return
  try {
    await api()?.upsertLocalEntity?.(plain)
  } catch {
    /* mirror is best-effort */
  }
}

async function safeDelete(type: LocalStoreEntityType, id: string) {
  const plain = toPlainIpcValue({ type, id })
  if (!plain) return
  try {
    await api()?.deleteLocalEntity?.(plain)
  } catch {
    /* mirror is best-effort */
  }
}

function flushPending(): void {
  flushTimer = null
  const jobs = [...pending.values()]
  pending.clear()

  for (const job of jobs) {
    try {
      if (job.op === 'delete') {
        if (!job.id) continue
        void safeDelete(job.type, job.id)
      } else if (job.payload) {
        const payload = toPlainIpcValue(job.payload)
        if (!payload) continue
        const searchText = searchTextForVoiceCapture(payload)
        if (!searchText.trim()) continue
        void safeUpsert({
          type: job.type,
          id: String(job.id),
          payload,
          searchText,
          updatedAt: job.updatedAt || new Date().toISOString(),
        })
      }
    } catch {
      /* never throw to callers */
    }
  }
}

function scheduleFlush(): void {
  if (flushTimer != null) return
  flushTimer = setTimeout(flushPending, DEBOUNCE_MS)
}

function scheduleLocalMirror(params: {
  type: LocalStoreEntityType
  id: string
  payload?: Record<string, unknown>
  updatedAt?: string
  op: MirrorOp
}): void {
  try {
    if (!isElectron || !params.id) return
    pending.set(jobKey(params.type, params.id), params)
    scheduleFlush()
  } catch {
    /* never throw to callers */
  }
}

export function scheduleLocalMirrorUpsert(
  type: LocalStoreEntityType,
  id: string,
  payload: Record<string, unknown>,
  updatedAt?: string,
): void {
  const plain = toPlainIpcValue(payload)
  if (!plain) return
  scheduleLocalMirror({
    type,
    id,
    payload: plain,
    updatedAt,
    op: 'upsert',
  })
}

export function scheduleLocalMirrorDelete(type: LocalStoreEntityType, id: string): void {
  scheduleLocalMirror({ type, id, op: 'delete' })
}

/** Test helper: flush debounced mirror jobs immediately. */
export function flushLocalMirrorBusForTests(): void {
  if (flushTimer != null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  flushPending()
}

/** Drop pending mirror jobs (e.g. on logout or account switch). */
export function clearLocalMirrorBus(): void {
  if (flushTimer != null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  pending.clear()
}
