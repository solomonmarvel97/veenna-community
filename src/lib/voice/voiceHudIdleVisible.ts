/** When false, the Electron HUD stays hidden until dictation starts and hides again after processing. */
const VOICE_HUD_IDLE_VISIBLE_STORAGE_KEY = 'veenna-hud-idle-visible'

export function readHudIdleVisible(): boolean {
  try {
    const raw = localStorage.getItem(VOICE_HUD_IDLE_VISIBLE_STORAGE_KEY)
    if (raw === '0' || raw === 'false') return false
    if (raw === '1' || raw === 'true') return true
  } catch {
    /* private mode */
  }
  // Off until the owner turns it on.
  return false
}

export function writeHudIdleVisible(visible: boolean) {
  try {
    localStorage.setItem(VOICE_HUD_IDLE_VISIBLE_STORAGE_KEY, visible ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function isHudIdleVisibleSyncEvent(event: StorageEvent): boolean {
  return event.key === VOICE_HUD_IDLE_VISIBLE_STORAGE_KEY
}

export async function applyHudIdleVisibleToElectron(visible: boolean): Promise<void> {
  if (typeof window === 'undefined') return
  const api = window.veennaElectron?.setHudIdleVisible
  if (!api) return
  const result = await api(visible)
  if (result?.ok === false) {
    const reason =
      typeof (result as { reason?: string }).reason === 'string'
        ? ((result as { reason?: string }).reason as string)
        : 'Could not update HUD visibility.'
    throw new Error(reason)
  }
}
