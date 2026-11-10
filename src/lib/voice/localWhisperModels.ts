import catalog from './whisper-model-catalog.json'

export type LocalSpeechModelTier = 'light' | 'balanced' | 'quality' | 'large'
export type LocalSpeechModelFamily = 'whisper' | 'ctc'
type LocalSpeechModelTag =
  'English accuracy' | 'Speed' | 'Multilingual' | 'Edge' | 'Streaming'
export type LocalSpeechModelRuntime =
  'onnx-transformers-js' | 'onnx-node' | 'whisper-cpp' | 'nemo' | 'pytorch-hf' | 'mlx-gguf'

export type SpeechRuntimeCapabilitiesLike = {
  runtimes?: Partial<Record<LocalSpeechModelRuntime, { ready?: boolean }>>
} | null

export type LocalSpeechModelId = (typeof catalog)[number]['id']

/** @deprecated use LocalSpeechModelId */
export type LocalWhisperModelId = LocalSpeechModelId

export type LocalSpeechModelDef = {
  id: LocalSpeechModelId
  label: string
  provider: string
  family: LocalSpeechModelFamily
  tier: LocalSpeechModelTier
  sizeLabel: string
  description: string
  bundled: boolean
  huggingFaceUrl: string
  /** When false, model is listed for reference but cannot be downloaded yet. */
  localAvailable?: boolean
  /** Inference stack required to run this model locally. */
  runtime?: LocalSpeechModelRuntime
  /** whisper-cpp models: the single ggml file, under huggingFaceUrl. */
  file?: string
  tags?: LocalSpeechModelTag[]
}

/** @deprecated use LOCAL_SPEECH_MODELS */
const LOCAL_WHISPER_MODELS: LocalSpeechModelDef[] = catalog as LocalSpeechModelDef[]

export const LOCAL_SPEECH_MODELS = LOCAL_WHISPER_MODELS

/**
 * Preferred on-device pick: Whisper Base through veenna-whisper (whisper.cpp, GPU).
 * Ships inside the desktop app, so a fresh install dictates at once.
 */
export const DEFAULT_LOCAL_SPEECH_MODEL_ID: LocalSpeechModelId = 'ggml/whisper-base-q5_1'

/**
 * The ONNX model for where veenna-whisper cannot run (no helper built for that
 * system, or the web). Ships inside the app only on those systems; where
 * veenna-whisper ships, the build leaves it out (scripts/lib/pruneShippedApp.cjs)
 * and Settings offers it as a download.
 */
export const BUNDLED_LOCAL_SPEECH_MODEL_ID: LocalSpeechModelId = 'Xenova/whisper-tiny'

/** @deprecated use DEFAULT_LOCAL_SPEECH_MODEL_ID */
export const DEFAULT_LOCAL_WHISPER_MODEL_ID = DEFAULT_LOCAL_SPEECH_MODEL_ID

const MODEL_MAP = new Map(LOCAL_SPEECH_MODELS.map((model) => [model.id, model]))

export function localSpeechModelDef(id: string): LocalSpeechModelDef | undefined {
  return MODEL_MAP.get(id as LocalSpeechModelId)
}

function isLocalSpeechModelId(value: string): value is LocalSpeechModelId {
  return MODEL_MAP.has(value as LocalSpeechModelId)
}

/** @deprecated use isLocalSpeechModelId */
export const isLocalWhisperModelId = isLocalSpeechModelId

export function tierLabel(tier: LocalSpeechModelTier): string {
  switch (tier) {
    case 'light':
      return 'Light'
    case 'balanced':
      return 'Balanced'
    case 'quality':
      return 'Quality'
    case 'large':
      return 'Large'
  }
}

export function familyLabel(family: LocalSpeechModelFamily): string {
  switch (family) {
    case 'whisper':
      return 'Whisper (seq2seq)'
    case 'ctc':
      return 'CTC (Wav2Vec2 / HuBERT / MMS)'
  }
}

export function speechModelRuntime(
  model: Pick<LocalSpeechModelDef, 'id' | 'runtime' | 'localAvailable'>,
) {
  if (model.runtime) return model.runtime
  return model.localAvailable === false ? 'pytorch-hf' : 'onnx-transformers-js'
}

function effectiveSpeechRuntime(
  model: Pick<LocalSpeechModelDef, 'id' | 'runtime' | 'localAvailable'>,
  capabilities: SpeechRuntimeCapabilitiesLike,
): LocalSpeechModelRuntime {
  const catalogRuntime = speechModelRuntime(model)
  if (catalogRuntime !== 'onnx-transformers-js') return catalogRuntime
  if (model.localAvailable === false) return catalogRuntime
  if (capabilities?.runtimes?.['onnx-node']?.ready) return 'onnx-node'
  return 'onnx-transformers-js'
}

export function speechModelRuntimeLabel(
  model: Pick<LocalSpeechModelDef, 'id' | 'runtime' | 'localAvailable'>,
  capabilities?: SpeechRuntimeCapabilitiesLike,
): string {
  const runtime = capabilities
    ? effectiveSpeechRuntime(model, capabilities)
    : speechModelRuntime(model)
  switch (runtime) {
    case 'onnx-node':
      return 'ONNX Runtime (Node)'
    case 'onnx-transformers-js':
      return 'ONNX · transformers.js'
    case 'whisper-cpp':
      return 'whisper.cpp · GPU'
    case 'nemo':
      return 'NVIDIA NeMo'
    case 'pytorch-hf':
      return 'PyTorch · Hugging Face'
    case 'mlx-gguf':
      return 'MLX / GGUF'
  }
}

export const SPEECH_MODEL_PROVIDERS = [
  ...new Set(LOCAL_SPEECH_MODELS.map((m) => m.provider)),
].sort()

export function isWhisperFamilyModel(id: string) {
  return localSpeechModelDef(id)?.family === 'whisper'
}

