import { guestSttUnavailableMessage } from '@/lib/voice/configureGuestSttEnv'
import { isElectron } from '@/lib/platform/isElectron'
import {
  DEFAULT_LOCAL_SPEECH_MODEL_ID,
  localSpeechModelDef,
  type LocalSpeechModelId,
} from '@/lib/voice/localWhisperModels'
import { checkLocalWhisperModelInstalled } from '@/lib/voice/localStt'
import { readSpeechModelSettings, writeSpeechModelSettings } from '@/lib/voice/speechModelSettings'
import {
  downloadWhisperModel,
  listWhisperModels,
  subscribeWhisperModelDownloadProgress,
  type WhisperModelDownloadProgress,
} from '@/lib/voice/whisperModelClient'

export type EnsureLocalSpeechModelResult = {
  ok: boolean
  modelId: LocalSpeechModelId
  downloaded?: boolean
  reason?: string
}

function modelLabel(modelId: LocalSpeechModelId) {
  return localSpeechModelDef(modelId)?.label || modelId
}

/**
 * Ensure a runnable on-device speech model is installed.
 * Desktop builds ship Whisper Base (and Tiny as a fallback); when none is present it is downloaded automatically.
 */
export async function ensureLocalSpeechModelInstalled(options?: {
  modelId?: LocalSpeechModelId
  onProgress?: (progress: WhisperModelDownloadProgress & { label: string }) => void
}): Promise<EnsureLocalSpeechModelResult> {
  const targetId = options?.modelId ?? DEFAULT_LOCAL_SPEECH_MODEL_ID
  const label = modelLabel(targetId)

  if (!isElectron) {
    const available = await checkLocalWhisperModelInstalled(targetId)
    if (available) return { ok: true, modelId: targetId }
    return { ok: false, modelId: targetId, reason: guestSttUnavailableMessage() }
  }

  const models = await listWhisperModels()
  const preferred = readSpeechModelSettings().localModelId
  const preferredInstalled = models.find((model) => model.id === preferred && model.installed)
  if (preferredInstalled) {
    return { ok: true, modelId: preferred }
  }

  const targetInstalled = models.find((model) => model.id === targetId && model.installed)
  if (targetInstalled) {
    if (preferred !== targetId) writeSpeechModelSettings({ localModelId: targetId })
    return { ok: true, modelId: targetId }
  }

  const anyInstalled = models.find((model) => model.installed)
  if (anyInstalled && isLocalModelId(anyInstalled.id)) {
    writeSpeechModelSettings({ localModelId: anyInstalled.id })
    return { ok: true, modelId: anyInstalled.id }
  }

  options?.onProgress?.({
    modelId: targetId,
    phase: 'downloading',
    file: null,
    fileIndex: 0,
    fileCount: 0,
    percent: 0,
    label,
  })

  const unsubscribe = subscribeWhisperModelDownloadProgress((progress) => {
    if (progress.modelId !== targetId) return
    options?.onProgress?.({ ...progress, label })
  })

  try {
    const result = await downloadWhisperModel(targetId)
    if (!result?.ok) {
      return {
        ok: false,
        modelId: targetId,
        reason:
          result?.reason === 'download_in_progress'
            ? `${label} is already downloading. Try again in a moment.`
            : result?.reason || `Could not download ${label}`,
      }
    }
    writeSpeechModelSettings({ localModelId: targetId })
    return { ok: true, modelId: targetId, downloaded: true }
  } finally {
    unsubscribe()
  }
}

function isLocalModelId(value: string): value is LocalSpeechModelId {
  return Boolean(localSpeechModelDef(value))
}
