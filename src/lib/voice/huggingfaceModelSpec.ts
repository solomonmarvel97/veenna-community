import { getRequiredSpeechModelFiles } from '@/lib/voice/speechModelFiles'
import type { LocalSpeechModelDef } from '@/lib/voice/localWhisperModels'

const HF_MODEL_API = 'https://huggingface.co/api/models'
const CACHE_PREFIX = 'veennahf-model-spec.v1'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

type HfTreeEntry = {
  type?: string
  path?: string
  size?: number
}

type HfModelInfo = {
  safetensors?: {
    total?: number
  }
}

export type HuggingFaceModelSpec = {
  modelId: string
  downloadBytes: number
  downloadMb: number
  matchedFiles: { path: string; bytes: number }[]
  missingFiles: string[]
  fetchedAt: string
  source: 'huggingface'
}

const memoryCache = new Map<string, HuggingFaceModelSpec>()
const inflight = new Map<string, Promise<HuggingFaceModelSpec | null>>()

function cacheKey(modelId: string) {
  return `${CACHE_PREFIX}:${modelId}`
}

function readCached(modelId: string): HuggingFaceModelSpec | null {
  const hit = memoryCache.get(modelId)
  if (hit) return hit

  try {
    const raw = localStorage.getItem(cacheKey(modelId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as HuggingFaceModelSpec
    if (Date.now() - Date.parse(parsed.fetchedAt) > CACHE_TTL_MS) {
      localStorage.removeItem(cacheKey(modelId))
      return null
    }
    memoryCache.set(modelId, parsed)
    return parsed
  } catch {
    return null
  }
}

function writeCached(spec: HuggingFaceModelSpec) {
  memoryCache.set(spec.modelId, spec)
  try {
    localStorage.setItem(cacheKey(spec.modelId), JSON.stringify(spec))
  } catch {
    // Ignore quota errors; memory cache still helps this session.
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function weightLikePath(path: string) {
  return /\.(onnx|safetensors|bin|gguf|pt|pth)$/i.test(path)
}

function buildSpec(
  modelId: string,
  requiredFiles: readonly string[],
  tree: HfTreeEntry[],
  info: HfModelInfo | null,
): HuggingFaceModelSpec | null {
  const files = tree.filter((entry) => entry.type === 'file' && entry.path)
  const sizeByPath = new Map<string, number>()
  for (const entry of files) {
    if (!entry.path) continue
    sizeByPath.set(entry.path, entry.size ?? 0)
  }

  const matchedFiles = requiredFiles
    .filter((path) => sizeByPath.has(path))
    .map((path) => ({ path, bytes: sizeByPath.get(path) ?? 0 }))

  const missingFiles = requiredFiles.filter((path) => !sizeByPath.has(path))
  let downloadBytes = matchedFiles.reduce((sum, file) => sum + file.bytes, 0)

  if (downloadBytes <= 0 || missingFiles.length > 0) {
    const safetensorsTotal = info?.safetensors?.total
    if (typeof safetensorsTotal === 'number' && safetensorsTotal > 0) {
      downloadBytes = safetensorsTotal
    } else {
      downloadBytes = files.reduce((sum, entry) => {
        if (!entry.path || !weightLikePath(entry.path)) return sum
        return sum + (entry.size ?? 0)
      }, 0)
    }
  }

  if (downloadBytes <= 0) return null

  return {
    modelId,
    downloadBytes,
    downloadMb: downloadBytes / (1024 * 1024),
    matchedFiles,
    missingFiles,
    fetchedAt: new Date().toISOString(),
    source: 'huggingface',
  }
}

export async function fetchHuggingFaceModelSpec(
  model: Pick<LocalSpeechModelDef, 'id' | 'family'>,
  options?: { refresh?: boolean },
): Promise<HuggingFaceModelSpec | null> {
  if (!options?.refresh) {
    const cached = readCached(model.id)
    if (cached) return cached
  }

  const existing = inflight.get(model.id)
  if (existing) return existing

  const promise = (async () => {
    const requiredFiles = getRequiredSpeechModelFiles(model)
    const [tree, info] = await Promise.all([
      fetchJson<HfTreeEntry[]>(`${HF_MODEL_API}/${model.id}/tree/main?recursive=true`),
      fetchJson<HfModelInfo>(`${HF_MODEL_API}/${model.id}`),
    ])

    if (!tree?.length) return null

    const spec = buildSpec(model.id, requiredFiles, tree, info)
    if (spec) writeCached(spec)
    return spec
  })().finally(() => {
    inflight.delete(model.id)
  })

  inflight.set(model.id, promise)
  return promise
}

export async function prefetchHuggingFaceModelSpecs(
  models: Pick<LocalSpeechModelDef, 'id' | 'family'>[],
) {
  await Promise.all(models.map((model) => fetchHuggingFaceModelSpec(model)))
}

export function getCachedHuggingFaceModelSpec(modelId: string) {
  return readCached(modelId)
}
