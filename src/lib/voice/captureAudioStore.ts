/**
 * Local IndexedDB store for voice-capture playback audio.
 * Prefer cloud (R2) sync via voiceCaptureAudioSync; IndexedDB is the local cache.
 *
 * Shared across Electron windows on the same origin (HUD + main).
 */

const DB_NAME = 'veenna-capture-audio'
const DB_VERSION = 1
const STORE_NAME = 'audio'

type CaptureAudioRecord = {
  id: string
  blob: Blob
  mimeType: string
  updatedAt: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error ?? new Error('Failed to open capture audio DB'))
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function waitForTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}

export async function putCaptureAudio(id: string, blob: Blob): Promise<void> {
  if (!id || !blob?.size) return
  const db = await openDb()
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const record: CaptureAudioRecord = {
      id,
      blob,
      mimeType: blob.type || 'audio/webm',
      updatedAt: new Date().toISOString(),
    }
    store.put(record)
    // Must wait for commit before closing - otherwise Electron can drop the write.
    await waitForTransaction(tx)
  } finally {
    db.close()
  }
}

export async function getCaptureAudio(id: string): Promise<Blob | null> {
  if (!id) return null
  const db = await openDb()
  try {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const record = await idbRequest(store.get(id) as IDBRequest<CaptureAudioRecord | undefined>)
    await waitForTransaction(tx)
    return record?.blob ?? null
  } finally {
    db.close()
  }
}

export async function hasCaptureAudio(id: string): Promise<boolean> {
  if (!id) return false
  const db = await openDb()
  try {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const record = await idbRequest(store.get(id) as IDBRequest<CaptureAudioRecord | undefined>)
    await waitForTransaction(tx)
    return Boolean(record?.blob && record.blob.size > 0)
  } finally {
    db.close()
  }
}

export async function deleteCaptureAudio(id: string): Promise<void> {
  if (!id) return
  const db = await openDb()
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.delete(id)
    await waitForTransaction(tx)
  } finally {
    db.close()
  }
}

/** Held briefly between recorder stop and capture persist (per renderer). */
let pendingCaptureAudio: Blob | null = null

export function setPendingCaptureAudio(blob: Blob | null) {
  pendingCaptureAudio = blob && blob.size > 0 ? blob : null
}

export function peekPendingCaptureAudio(): Blob | null {
  return pendingCaptureAudio
}

export function takePendingCaptureAudio(): Blob | null {
  const blob = pendingCaptureAudio
  pendingCaptureAudio = null
  return blob
}

export function clearPendingCaptureAudio() {
  pendingCaptureAudio = null
}

export function preferredPlaybackBlob(
  blob: Blob | null | undefined,
  systemBlob?: Blob | null,
  mixedBlob?: Blob | null,
): Blob | null {
  const candidate = mixedBlob ?? blob ?? systemBlob ?? null
  return candidate && candidate.size > 0 ? candidate : null
}
