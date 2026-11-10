import { isElectron } from '@/lib/platform/isElectron'

const STORAGE_KEY = 'veenna-privacy-settings'
/** Mute-music is opt-in; bump when resetting the default for everyone. */
const DUCK_AUDIO_POLICY = 'opt-in-v1'

type PrivacyMode = 'standard' | 'strict'
type LocalDataStorageMode = 'device' | 'cloud'

export type PrivacySettings = {
  /** When strict, dictation data is not used for model training (policy preference). */
  privacyMode: PrivacyMode
  /** Sync voice / private product data to the cloud for cross-device access (default on). */
  privateCloudSync: boolean
  /** Use foreground app name to improve spelling and routing. */
  contextAwareness: boolean
  /** Device keeps a local search index; cloud relies on server data only. */
  localDataStorage: LocalDataStorageMode
  /** Lower other system audio while recording (desktop only). Off until the user opts in. */
  duckAudioWhileDictating: boolean
  /** Marks mute-music as under the opt-in default policy. */
  duckAudioPolicy?: string
}

const DEFAULTS: PrivacySettings = {
  privacyMode: 'standard',
  /** Default on: signed-in users sync automatically unless they opt into local-only. */
  privateCloudSync: true,
  contextAwareness: true,
  localDataStorage: 'device',
  duckAudioWhileDictating: false,
  duckAudioPolicy: DUCK_AUDIO_POLICY,
}

function normalize(raw: Partial<PrivacySettings> | null | undefined): PrivacySettings {
  const localDataStorage =
    isElectron || raw?.localDataStorage !== 'cloud' ? 'device' : ('cloud' as const)
  const underOptInPolicy = raw?.duckAudioPolicy === DUCK_AUDIO_POLICY
  return {
    privacyMode: raw?.privacyMode === 'strict' ? 'strict' : 'standard',
    privateCloudSync: raw?.privateCloudSync !== false,
    contextAwareness: raw?.contextAwareness !== false,
    localDataStorage,
    // Pre-policy installs may have had mute music on; reset to off until they opt in again.
    duckAudioWhileDictating: underOptInPolicy ? Boolean(raw?.duckAudioWhileDictating) : false,
    duckAudioPolicy: DUCK_AUDIO_POLICY,
  }
}

function readPrivacySettings(): PrivacySettings {
  if (typeof localStorage === 'undefined') return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    return normalize(JSON.parse(raw) as Partial<PrivacySettings>)
  } catch {
    return { ...DEFAULTS }
  }
}

export function writePrivacySettings(partial: Partial<PrivacySettings>): PrivacySettings {
  const merged = { ...readPrivacySettings(), ...partial }
  if (isElectron) {
    merged.localDataStorage = 'device'
  }
  const next = normalize(merged)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota errors */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('veenna-privacy-settings-changed', { detail: next }))
  }
  return next
}

export function isContextAwarenessEnabled(): boolean {
  return readPrivacySettings().contextAwareness
}

export function isDuckAudioWhileDictatingEnabled(): boolean {
  return readPrivacySettings().duckAudioWhileDictating
}
