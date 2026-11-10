import { onMounted, onUnmounted } from 'vue'
import { useSettings } from '@/composables/useSettings'
import { getVeennaElectron, isElectronMainWindow } from '@/lib/platform/isElectron'
import { isSettingsTab, type SettingsTab } from '@/router/paths'

function resolveSettingsTab(tab: unknown): SettingsTab {
  return typeof tab === 'string' && isSettingsTab(tab) ? tab : 'general'
}

/** Tray / menu Preferences → focus main window and open Settings. */
export function useElectronSettingsBridge() {
  const { openSettings } = useSettings()
  let unsub: (() => void) | undefined

  onMounted(() => {
    if (!isElectronMainWindow) return
    const off = getVeennaElectron()?.onOpenSettingsModal?.((payload) => {
      openSettings(resolveSettingsTab(payload?.tab))
    })
    unsub = typeof off === 'function' ? off : undefined
  })

  onUnmounted(() => {
    unsub?.()
  })
}
