/**
 * Developer mode: the toggle in Settings → Developer. Kept on this device only.
 * Reactive so the "View trace" item in the dictation history appears and
 * disappears with it, without a reload.
 */

import { computed, ref } from 'vue'
import type { TraceLevel } from './types'

const STORAGE_KEY = 'veenna-developer-mode'

function readStored(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    return Boolean((JSON.parse(raw) as { enabled?: boolean }).enabled)
  } catch {
    return false
  }
}

const enabled = ref(readStored())

export const developerModeEnabled = computed(() => enabled.value)
export const traceLevel = computed<TraceLevel>(() => (enabled.value ? 'verbose' : 'off'))
export const verboseActive = computed(() => enabled.value)
export const tracingActive = computed(() => enabled.value)

export function setDeveloperMode(next: boolean): void {
  enabled.value = next
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: next, level: 'verbose' }))
  } catch {
    /* a browser refusing storage is not a reason to break the toggle */
  }
}

if (typeof window !== 'undefined') {
  // The HUD and the main window are separate windows; keep them in step.
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) enabled.value = readStored()
  })
}

export { STORAGE_KEY as DEVELOPER_MODE_STORAGE_KEY }
