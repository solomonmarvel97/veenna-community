import type { pipeline } from '@xenova/transformers'
import {
  guestSttUnavailableMessage,
  isGuestWhisperModelAvailable,
  loadGuestSttTransformers,
} from '@/lib/voice/configureGuestSttEnv'
import {
  decodeSpeechBlobForWhisper,
  WHISPER_SAMPLE_RATE,
} from '@/lib/voice/decodeSpeechBlobForWhisper'
import { readSpeechModelSettings } from '@/lib/voice/speechModelSettings'
import {
  BUNDLED_LOCAL_SPEECH_MODEL_ID,
  isWhisperFamilyModel,
  type LocalSpeechModelId,
} from '@/lib/voice/localWhisperModels'
import { getVeennaElectron, isElectron } from '@/lib/platform/isElectron'

export type GuestTranscript = {
  text: string
  durationMs: number | null
  /** Where the time went ("decode 12ms · whisper.cpp 80ms"), for the dictation trace. */
  timing?: string
}

let transcriberPromise: ReturnType<typeof pipeline> | null = null
let loadedModelId: string | null = null
let modelReady = false

async function resolveRunnableModelId(): Promise<LocalSpeechModelId> {
  const preferred = readSpeechModelSettings().localModelId
  if (await isGuestWhisperModelAvailable(preferred)) return preferred
  if (preferred !== BUNDLED_LOCAL_SPEECH_MODEL_ID) {
    if (await isGuestWhisperModelAvailable(BUNDLED_LOCAL_SPEECH_MODEL_ID)) {
      return BUNDLED_LOCAL_SPEECH_MODEL_ID
    }
  }
  return preferred
}

function selectedModelId() {
  return readSpeechModelSettings().localModelId
}

function useMainProcessStt() {
  return isElectron && Boolean(getVeennaElectron()?.transcribeLocalAudio)
}

async function getTranscriber() {
  const modelId = await resolveRunnableModelId()
  if (transcriberPromise && loadedModelId !== modelId) {
    transcriberPromise = null
    loadedModelId = null
    modelReady = false
  }

  if (!transcriberPromise) {
    if (!(await isGuestWhisperModelAvailable(modelId))) {
      throw new Error(guestSttUnavailableMessage())
    }
    const { pipeline } = await loadGuestSttTransformers()
    loadedModelId = modelId
    transcriberPromise = pipeline('automatic-speech-recognition', modelId, {
      quantized: true,
      local_files_only: import.meta.env.VITE_IS_ELECTRON === 'true',
    })
  }
  return transcriberPromise
}

export function resetGuestSttModel() {
  if (useMainProcessStt()) {
    void getVeennaElectron()?.resetLocalSttModel?.()
  }
  transcriberPromise = null
  loadedModelId = null
  modelReady = false
}

export async function preloadGuestSttModel() {
  if (useMainProcessStt()) {
    try {
      const result = await getVeennaElectron()?.preloadLocalSttModel?.({
        modelId: selectedModelId(),
      })
      modelReady = result?.ok === true
    } catch (err) {
      modelReady = false
      console.warn('[guest-stt] preload skipped:', err instanceof Error ? err.message : err)
    }
    return
  }

  try {
    await getTranscriber()
    modelReady = true
  } catch (err) {
    modelReady = false
    console.warn('[guest-stt] preload skipped:', err instanceof Error ? err.message : err)
  }
}

async function transcribeGuestBlobInRenderer(
  blob: Blob,
  options?: { language?: string | null; durationMs?: number | null },
): Promise<{ text: string; durationMs: number | null }> {
  const transcriber = await getTranscriber()
  modelReady = true

  const url = URL.createObjectURL(blob)
  try {
    const modelId = await resolveRunnableModelId()
    const pipelineOptions: Record<string, unknown> = {
      return_timestamps: false,
      chunk_length_s: 30,
      stride_length_s: 5,
    }
    if (isWhisperFamilyModel(modelId)) {
      pipelineOptions.language = options?.language?.trim().slice(0, 16) || 'english'
      pipelineOptions.task = 'transcribe'
    }
    const output = (await (
      transcriber as (
        audio: string,
        options?: Record<string, unknown>,
      ) => Promise<{ text?: string }>
    )(url, pipelineOptions)) as { text?: string }

    const text = String(output?.text || '').trim()
    return { text, durationMs: options?.durationMs ?? null }
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function transcribeGuestBlobInMainProcess(
  blob: Blob,
  options?: { language?: string | null; durationMs?: number | null },
): Promise<GuestTranscript> {
  const electron = getVeennaElectron()
  if (!electron?.transcribeLocalAudio) {
    throw new Error(guestSttUnavailableMessage())
  }

  // Main-process Whisper expects mono PCM @ 16 kHz - not the raw WebM blob.
  const decodeStartedAt = performance.now()
  const samples = await decodeSpeechBlobForWhisper(blob)
  const decodeMs = Math.round(performance.now() - decodeStartedAt)
  if (!samples.length) {
    return { text: '', durationMs: options?.durationMs ?? null, timing: `decode ${decodeMs}ms` }
  }

  const result = await electron.transcribeLocalAudio({
    samples: samples.buffer.slice(
      samples.byteOffset,
      samples.byteOffset + samples.byteLength,
    ) as ArrayBuffer,
    sampleRate: WHISPER_SAMPLE_RATE,
    // Main checks the files on disk itself; probing /models/ here would only add two fetches.
    modelId: selectedModelId(),
    language: options?.language ?? null,
    durationMs: options?.durationMs ?? null,
  })

  if (!result?.ok) {
    throw new Error(result?.reason || guestSttUnavailableMessage())
  }

  modelReady = true
  const engine = result.runtime === 'whisper-cpp' ? 'whisper.cpp' : (result.runtime ?? 'model')
  return {
    text: String(result.text || '').trim(),
    durationMs: result.durationMs ?? options?.durationMs ?? null,
    timing: `decode ${decodeMs}ms · ${engine} ${result.inferenceMs ?? '?'}ms`,
  }
}

export async function transcribeGuestBlob(
  blob: Blob,
  options?: { language?: string | null; durationMs?: number | null },
): Promise<GuestTranscript> {
  if (!blob?.size) {
    return { text: '', durationMs: options?.durationMs ?? null }
  }

  if (useMainProcessStt()) {
    return transcribeGuestBlobInMainProcess(blob, options)
  }

  return transcribeGuestBlobInRenderer(blob, options)
}

export async function checkLocalWhisperModelInstalled(modelId = selectedModelId()) {
  return isGuestWhisperModelAvailable(modelId)
}
