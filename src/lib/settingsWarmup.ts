/**
 * Have the Settings page ready before anybody asks for it. The page and its tab panels are
 * lazy chunks; this starts the import the moment Settings is asked for, so the click does not
 * wait on the fetch.
 */

import { scheduleIdleWork } from '@/lib/scheduleIdleWork'
import type { SettingsTab } from '@/router/paths'

const loadSettingsPage = () => import('@/views/SettingsView.vue')

/** Tab panels, each its own chunk. General arrives with the page. */
const loadSystem = () => import('@/components/settings/SettingsSystemPanel.vue')
const loadPermissions = () => import('@/components/settings/SettingsPermissionsPanel.vue')
const loadAppearance = () => import('@/components/settings/SettingsAppearancePanel.vue')
const loadDictation = () => import('@/components/settings/SettingsDictationPanel.vue')
const loadSpeechModels = () => import('@/components/settings/SettingsSpeechModelsPanel.vue')

const PANEL_LOADERS: Record<string, () => Promise<unknown>> = {
  system: loadSystem,
  permissions: loadPermissions,
  appearance: loadAppearance,
  dictation: loadDictation,
  models: loadSpeechModels,
  'speech-models': loadSpeechModels,
}

let panelsWarmed = false

/** Best-effort: a failed preload must never surface. The real import reports. */
function warm(load: () => Promise<unknown>) {
  void load().catch(() => undefined)
}

/** Start the page (and the tab being opened) the moment Settings is asked for. */
export function prefetchSettings(tab: SettingsTab | string = 'general') {
  warm(loadSettingsPage)
  const load = PANEL_LOADERS[tab]
  if (load) warm(load)
}

/** Called once the page is open, so switching tabs is instant too. */
export function warmSettingsPanels() {
  if (panelsWarmed) return
  panelsWarmed = true
  scheduleIdleWork(() => {
    const seen = new Set<() => Promise<unknown>>()
    for (const load of Object.values(PANEL_LOADERS)) {
      if (seen.has(load)) continue
      seen.add(load)
      warm(load)
    }
  })
}
