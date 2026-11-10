import JSZip from 'jszip'
import { listLocalEntities } from '@/lib/localStore/localStoreClient'
import { getCaptureAudio } from '@/lib/voice/captureAudioStore'
import { getVeennaElectron } from '@/lib/platform/isElectron'
import { useVoiceCapturesStore } from '@/stores/voiceCaptures'
import { useTodosStore } from '@/stores/todos'

/**
 * The .veennapack file: how dictations move from Veenna Community to the full Veenna app.
 *
 * A zip with `manifest.json`, `captures.json` (every saved dictation, as stored),
 * `audio/<captureId>` for each recording that still has audio, and `todos.json` (every Todo list
 * and task, steps inside the task). The full app reads the same
 * layout (keep the two copies of this file in step). Nothing here touches a server.
 */
const PACK_FORMAT = 'veennapack'
const PACK_VERSION = 2
type PackManifest = {
  format: typeof PACK_FORMAT
  version: number
  source: 'veenna-community'
  createdAt: string
  captureCount: number
  audioCount: number
  /** Todo lists and tasks; version 2 packs only. */
  todoListCount: number
  todoCount: number
}

type PackCapture = Record<string, unknown> & {
  id: string
  /** Set when the pack holds this capture's recording. */
  packedAudio?: { file: string; mimeType: string }
}

type BuiltPack = {
  bytes: Uint8Array
  captureCount: number
  audioCount: number
  todoListCount: number
  todoCount: number
}

async function readAllCaptures(): Promise<Record<string, unknown>[]> {
  const byId = new Map<string, Record<string, unknown>>()
  const listed = await listLocalEntities({ types: ['voice_capture'] })
  for (const entity of listed.entities ?? []) {
    const payload = entity.payload
    if (!payload) continue
    const id = String(payload.id ?? entity.id ?? '')
    if (id) byId.set(id, { ...payload, id })
  }
  // Captures still only in memory (just dictated) are part of the pack too.
  for (const capture of useVoiceCapturesStore().captures) {
    if (!byId.has(capture.id)) byId.set(capture.id, { ...capture })
  }
  return [...byId.values()]
}

async function readTodos() {
  const todos = useTodosStore()
  await todos.load()
  // A list nobody added a task to is just the empty default; it is not worth moving.
  const lists = todos.items.length ? todos.sortedLists.map((list) => ({ ...list })) : []
  const items = todos.items.map((item) => ({ ...item, steps: item.steps.map((step) => ({ ...step })) }))
  return { lists, items }
}

async function buildVeennaPack(): Promise<BuiltPack> {
  const captures = await readAllCaptures()
  const todos = await readTodos()
  const zip = new JSZip()
  const packed: PackCapture[] = []
  let audioCount = 0

  for (const capture of captures) {
    const id = String(capture.id)
    const entry: PackCapture = { ...capture, id }
    try {
      const blob = await getCaptureAudio(id)
      if (blob?.size) {
        const file = `audio/${id}`
        zip.file(file, await blob.arrayBuffer())
        entry.packedAudio = { file, mimeType: blob.type || 'audio/webm' }
        audioCount += 1
      }
    } catch {
      /* a recording that cannot be read still migrates as text */
    }
    packed.push(entry)
  }

  const manifest: PackManifest = {
    format: PACK_FORMAT,
    version: PACK_VERSION,
    source: 'veenna-community',
    createdAt: new Date().toISOString(),
    captureCount: packed.length,
    audioCount,
    todoListCount: todos.lists.length,
    todoCount: todos.items.length,
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  zip.file('captures.json', JSON.stringify(packed))
  if (todos.items.length) zip.file('todos.json', JSON.stringify(todos))

  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  return {
    bytes,
    captureCount: packed.length,
    audioCount,
    todoListCount: todos.lists.length,
    todoCount: todos.items.length,
  }
}

export type ExportResult =
  | {
      ok: true
      path: string
      captureCount: number
      audioCount: number
      todoListCount: number
      todoCount: number
    }
  | { ok: false; reason: 'empty' | 'unavailable' | 'failed'; message: string }

/** Builds the pack and has the app write it to Documents/Veenna Migration. */
export async function exportVeennaPack(
  options: { reveal?: boolean } = {},
): Promise<ExportResult> {
  const save = getVeennaElectron()?.saveCommunityPack
  if (!save) {
    return { ok: false, reason: 'unavailable', message: 'Export is only available in the app.' }
  }
  try {
    const built = await buildVeennaPack()
    if (built.captureCount === 0 && built.todoCount === 0) {
      return { ok: false, reason: 'empty', message: 'You have no dictations or tasks to move yet.' }
    }
    const saved = await save(built.bytes, { reveal: options.reveal !== false })
    if (!saved.ok || !saved.path) {
      return { ok: false, reason: 'failed', message: saved.message || 'Could not save the file.' }
    }
    return {
      ok: true,
      path: saved.path,
      captureCount: built.captureCount,
      audioCount: built.audioCount,
      todoListCount: built.todoListCount,
      todoCount: built.todoCount,
    }
  } catch (err) {
    return {
      ok: false,
      reason: 'failed',
      message: err instanceof Error ? err.message : 'Could not build the file.',
    }
  }
}
