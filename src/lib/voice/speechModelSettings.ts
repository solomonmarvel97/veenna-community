import {
  DEFAULT_LOCAL_WHISPER_MODEL_ID,
  isLocalWhisperModelId,
  type LocalWhisperModelId,
} from '@/lib/voice/localWhisperModels'

const STORAGE_KEY = 'veenna-speech-model-settings'
const CHANGED_EVENT = 'veenna-speech-model-settings-changed'

export type SpeechModelSettings = {
  /** The on-device model dictation uses. */
  localModelId: LocalWhisperModelId
  /** Bumped when product defaults change, to migrate stored settings once. */
  defaultsVersion?: number
}

/**
 * v3: default on-device model became Whisper Small (was Large v3).
 * v4: default is the bundled Whisper Base on whisper.cpp; Small took ~9 s a clip on one CPU thread.
 * v5: v4 again, for settings that were stamped v4 while still on Small (a v4 build without the move).
 */
const SETTINGS_DEFAULTS_VERSION = 5
const PREVIOUS_DEFAULT_LOCAL_MODEL_IDS: Record<number, string> = {
  3: 'Xenova/whisper-large-v3',
  5: 'Xenova/whisper-small',
}

const DEFAULTS: SpeechModelSettings = {
  localModelId: DEFAULT_LOCAL_WHISPER_MODEL_ID,
  defaultsVersion: SETTINGS_DEFAULTS_VERSION,
}

/** Clean up stored settings, moving a model that used to be the default onto the new default. */
function normalize(raw: Partial<SpeechModelSettings> | null | undefined): SpeechModelSettings {
  let localModelId =
    raw?.localModelId && isLocalWhisperModelId(raw.localModelId)
      ? raw.localModelId
      : DEFAULTS.localModelId
  const priorVersion = Number(raw?.defaultsVersion) || 0
  for (const [version, previousDefault] of Object.entries(PREVIOUS_DEFAULT_LOCAL_MODEL_IDS)) {
    if (priorVersion < Number(version) && localModelId === previousDefault) {
      localModelId = DEFAULTS.localModelId
    }
  }
  return { localModelId, defaultsVersion: SETTINGS_DEFAULTS_VERSION }
}

function save(settings: SpeechModelSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* ignore quota errors */
  }
}

export function readSpeechModelSettings(): SpeechModelSettings {
  if (typeof localStorage === 'undefined') return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<SpeechModelSettings>
    const next = normalize(parsed)
    // Persist the migration so it happens once, not on every read.
    if ((Number(parsed?.defaultsVersion) || 0) < SETTINGS_DEFAULTS_VERSION) save(next)
    return next
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeSpeechModelSettings(
  partial: Partial<SpeechModelSettings>,
): SpeechModelSettings {
  const next = normalize({ ...readSpeechModelSettings(), ...partial })
  save(next)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: next }))
  }
  return next
}

export function onSpeechModelSettingsChanged(
  handler: (settings: SpeechModelSettings) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<SpeechModelSettings>).detail
    handler(detail ?? readSpeechModelSettings())
  }
  window.addEventListener(CHANGED_EVENT, listener)
  return () => window.removeEventListener(CHANGED_EVENT, listener)
}
