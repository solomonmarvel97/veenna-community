import { getVeennaElectron, isElectron } from '@/lib/platform/isElectron'
import type { LocalWhisperModelId } from '@/lib/voice/localWhisperModels'

type WhisperModelInstallSource = 'bundled' | 'user' | null

export type WhisperModelStatus = {
  id: LocalWhisperModelId
  label: string
  provider: string
  family: string
  tier: string
  sizeLabel: string
  description: string
  bundled: boolean
  huggingFaceUrl: string
  installed: boolean
  source: WhisperModelInstallSource
  bytesOnDisk: number
  downloading: boolean
}

export type WhisperModelDownloadProgress = {
  modelId: LocalWhisperModelId
  phase: 'downloading' | 'done' | 'error'
  file: string | null
  fileIndex: number
  fileCount: number
  bytesReceived?: number
  bytesTotal?: number
  percent: number
}

type WhisperModelListResult = { ok: boolean; models?: WhisperModelStatus[]; reason?: string }
type WhisperModelMutationResult = WhisperModelListResult & { removed?: boolean }

function api() {
  return getVeennaElectron()
}

export async function listWhisperModels(): Promise<WhisperModelStatus[]> {
  if (!isElectron) return []
  const result = (await api()?.listWhisperModels?.()) as WhisperModelListResult | undefined
  return result?.ok && Array.isArray(result.models) ? result.models : []
}

export async function downloadWhisperModel(modelId: LocalWhisperModelId) {
  if (!isElectron) return { ok: false as const, reason: 'desktop_only' }
  return (await api()?.downloadWhisperModel?.(modelId)) as WhisperModelMutationResult
}

export async function cancelWhisperModelDownload(modelId: LocalWhisperModelId) {
  if (!isElectron) return { ok: false as const, reason: 'desktop_only' }
  return (await api()?.cancelWhisperModelDownload?.(modelId)) as { ok: boolean; reason?: string }
}

export async function deleteWhisperModel(modelId: LocalWhisperModelId) {
  if (!isElectron) return { ok: false as const, reason: 'desktop_only' }
  return (await api()?.deleteWhisperModel?.(modelId)) as WhisperModelMutationResult
}

export function subscribeWhisperModelDownloadProgress(
  handler: (progress: WhisperModelDownloadProgress) => void,
) {
  const unsubscribe = api()?.onWhisperModelDownloadProgress?.((payload) => {
    if (!payload || typeof payload !== 'object') return
    handler(payload as WhisperModelDownloadProgress)
  })
  return typeof unsubscribe === 'function' ? unsubscribe : () => {}
}

export function formatModelBytes(bytes: number) {
  if (!bytes) return '0 B'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
