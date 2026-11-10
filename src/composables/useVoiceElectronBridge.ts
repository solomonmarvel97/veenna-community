import { onMounted, onUnmounted } from 'vue'
import { isElectron } from '@/lib/platform/isElectron'
import { useVoiceSettingsStore } from '@/stores/voiceSettings'
import type { VoiceHotkey } from '@/types/electron'
import { warmDictationHudSounds } from '@/lib/voice/dictationHudSounds'

/** Connects this window to the main process for dictation: the shortcut and the HUD's visibility. */
export function useVoiceElectronBridge() {
  const voiceSettings = useVoiceSettingsStore()

  async function syncHotkeyFromSettings() {
    if (!isElectron || !window.veennaElectron?.registerHotkey) return
    try {
      const hotkey = voiceSettings.settings.hotkey as VoiceHotkey | null
      await window.veennaElectron.registerHotkey(hotkey ?? null)
    } catch {
      /* the shortcut is optional on boot */
    }
  }

  async function ensureDictationHotkey() {
    if (!isElectron || !window.veennaElectron?.startDictationHotkey) return

    const status = await window.veennaElectron.getDictationAccessibility?.()
    const result = await window.veennaElectron.startDictationHotkey()

    if (
      !result?.ok &&
      result?.reason === 'accessibility_required' &&
      status?.required &&
      !status.trusted
    ) {
      console.warn(
        '[dictation] Enable Veenna Community under System Settings → Privacy & Security → Accessibility for global Option capture.',
      )
    }
  }

  let stopHudSync: (() => void) | undefined
  let stopHudScreenShareSync: (() => void) | undefined

  onMounted(() => {
    void warmDictationHudSounds()
    void syncHotkeyFromSettings()
    stopHudSync =
      window.veennaElectron?.onHudIdleVisibleSync?.((payload) => {
        if (payload.persist) {
          void voiceSettings.setHudIdleVisible(Boolean(payload.visible))
          return
        }
        voiceSettings.syncHudIdleVisibleFromStorage()
      }) ?? undefined

    stopHudScreenShareSync =
      window.veennaElectron?.onHudScreenShareVisibleSync?.(() => {
        voiceSettings.syncHudVisibleDuringScreenShareFromStorage()
      }) ?? undefined
  })

  onUnmounted(() => {
    stopHudSync?.()
    stopHudScreenShareSync?.()
  })

  return { syncHotkeyFromSettings, ensureDictationHotkey }
}
