import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ROUTES, settingsPath, type SettingsTab } from '@/router/paths'
import { resolveSettingsTab } from '@/components/settings/settingsTabs'
import { isElectron } from '@/lib/platform/isElectron'
import { prefetchSettings } from '@/lib/settingsWarmup'

const activeTab = ref<SettingsTab>('general')
/** On a phone the menu and a page are separate screens; this is the one showing. */
const mobileView = ref<'list' | 'detail'>('list')

/** Point the page at a tab, falling back to General when it is not available here. */
function applySettingsTab(tab: SettingsTab): SettingsTab {
  const resolved = resolveSettingsTab(tab, isElectron)
  activeTab.value = resolved
  return resolved
}

export function useSettings() {
  const router = useRouter()

  /** Already on Settings, switching tab replaces the entry so Back leaves Settings in one step. */
  function goToTab(tab: SettingsTab, options?: { replace?: boolean }) {
    const location = settingsPath(tab)
    const onSettings = router.currentRoute.value.path === ROUTES.settings
    return options?.replace === false || !onSettings
      ? router.push(location)
      : router.replace(location)
  }

  /**
   * Go to Settings. With a tab, a phone lands on that tab's page; without,
   * on the menu.
   */
  function openSettings(tab?: SettingsTab) {
    const target = tab ?? 'general'
    prefetchSettings(target)
    const named = applySettingsTab(target)
    mobileView.value = tab ? 'detail' : 'list'
    return goToTab(named)
  }

  function setSettingsTab(tab: SettingsTab) {
    prefetchSettings(tab)
    return goToTab(applySettingsTab(tab))
  }

  /** The page was loaded or navigated to with this tab in its address. */
  function syncSettingsTab(tab: SettingsTab) {
    prefetchSettings(tab)
    applySettingsTab(tab)
  }

  function showSettingsDetail() {
    mobileView.value = 'detail'
  }

  function showSettingsList() {
    mobileView.value = 'list'
  }

  return {
    activeTab,
    mobileView,
    openSettings,
    setSettingsTab,
    syncSettingsTab,
    showSettingsDetail,
    showSettingsList,
  }
}
