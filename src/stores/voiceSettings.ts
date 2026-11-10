import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  applyHudIdleVisibleToElectron,
  readHudIdleVisible,
  writeHudIdleVisible,
} from '@/lib/voice/voiceHudIdleVisible'
import {
  applyHudVisibleDuringScreenShareToElectron,
  readHudVisibleDuringScreenShare,
  writeHudVisibleDuringScreenShare,
} from '@/lib/voice/voiceHudScreenShareVisible'
import {
  normalizeHudAppearance,
  readHudAppearance,
  writeHudAppearance,
  type HudAppearanceConfig,
} from '@/lib/voice/voiceHudAppearance'

/**
 * Dictation settings for Veenna Community. They live on this device (localStorage) and nowhere
 * else: there is no account to save them to.
 */

const STT_LANGUAGE_KEY = 'veenna-stt-language'

export type VoiceSettings = {
  /** A custom shortcut, on top of holding Option; null means none. */
  hotkey: Record<string, unknown> | null
  /** The language dictation listens for; null means detect it. */
  sttLanguage: string | null
  /** When true, the floating HUD logo is visible between dictation sessions. */
  hudIdleVisible: boolean
  /** When true, the floating HUD may appear in screen shares and recordings. */
  hudVisibleDuringScreenShare: boolean
}

const HOTKEY_KEY = 'veenna-dictation-hotkey'

function readHotkey(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(HOTKEY_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function writeHotkey(hotkey: Record<string, unknown> | null) {
  try {
    if (hotkey) localStorage.setItem(HOTKEY_KEY, JSON.stringify(hotkey))
    else localStorage.removeItem(HOTKEY_KEY)
  } catch {
    /* storage unavailable: the shortcut lasts until the app closes */
  }
}

function readSttLanguage(): string | null {
  try {
    const value = localStorage.getItem(STT_LANGUAGE_KEY)
    return value && value !== 'auto' ? value : null
  } catch {
    return null
  }
}

function writeSttLanguage(language: string | null) {
  try {
    if (language) localStorage.setItem(STT_LANGUAGE_KEY, language)
    else localStorage.removeItem(STT_LANGUAGE_KEY)
  } catch {
    /* storage unavailable: the choice lasts until the app closes */
  }
}

export const useVoiceSettingsStore = defineStore('voiceSettings', () => {
  const sttLanguage = ref<string | null>(readSttLanguage())
  const hotkey = ref<Record<string, unknown> | null>(readHotkey())
  const hudAppearance = ref<HudAppearanceConfig>(readHudAppearance())
  const hudIdleVisible = ref(readHudIdleVisible())
  const hudVisibleDuringScreenShare = ref(readHudVisibleDuringScreenShare())

  const settings = computed<VoiceSettings>(() => ({
    hotkey: hotkey.value,
    sttLanguage: sttLanguage.value,
    hudIdleVisible: hudIdleVisible.value,
    hudVisibleDuringScreenShare: hudVisibleDuringScreenShare.value,
  }))

  /** Nothing is fetched: kept so callers that ask the store to load keep working. */
  async function load() {
    syncHudIdleVisibleFromStorage()
    syncHudVisibleDuringScreenShareFromStorage()
    syncHudAppearanceFromStorage()
  }

  async function update(partial: Partial<VoiceSettings>) {
    if (partial.sttLanguage !== undefined) {
      sttLanguage.value = partial.sttLanguage
      writeSttLanguage(partial.sttLanguage)
    }
    if (partial.hotkey !== undefined) {
      hotkey.value = partial.hotkey
      writeHotkey(partial.hotkey)
    }
    if (partial.hudIdleVisible !== undefined) await setHudIdleVisible(partial.hudIdleVisible)
    if (partial.hudVisibleDuringScreenShare !== undefined) {
      await setHudVisibleDuringScreenShare(partial.hudVisibleDuringScreenShare)
    }
    return settings.value
  }

  async function setHudIdleVisible(visible: boolean) {
    const next = Boolean(visible)
    hudIdleVisible.value = next
    writeHudIdleVisible(next)
    await applyHudIdleVisibleToElectron(next)
  }

  function syncHudIdleVisibleFromStorage() {
    const visible = readHudIdleVisible()
    hudIdleVisible.value = visible
    void applyHudIdleVisibleToElectron(visible)
  }

  async function setHudVisibleDuringScreenShare(visible: boolean) {
    const next = Boolean(visible)
    hudVisibleDuringScreenShare.value = next
    writeHudVisibleDuringScreenShare(next)
    await applyHudVisibleDuringScreenShareToElectron(next)
  }

  function syncHudVisibleDuringScreenShareFromStorage() {
    const visible = readHudVisibleDuringScreenShare()
    hudVisibleDuringScreenShare.value = visible
    void applyHudVisibleDuringScreenShareToElectron(visible)
  }

  function syncHudAppearanceFromStorage() {
    hudAppearance.value = readHudAppearance()
  }

  function setHudAppearance(next: HudAppearanceConfig) {
    const normalized = normalizeHudAppearance(next)
    hudAppearance.value = normalized
    writeHudAppearance(normalized)
  }

  return {
    settings,
    sttLanguage,
    hudIdleVisible,
    hudVisibleDuringScreenShare,
    hudAppearance,
    load,
    update,
    setHudIdleVisible,
    syncHudIdleVisibleFromStorage,
    setHudVisibleDuringScreenShare,
    syncHudVisibleDuringScreenShareFromStorage,
    setHudAppearance,
    syncHudAppearanceFromStorage,
  }
})
