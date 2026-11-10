/** When true, the Electron HUD may appear in screen shares and recordings. */
const VOICE_HUD_SCREEN_SHARE_VISIBLE_STORAGE_KEY = 'veenna-hud-screen-share-visible'

export function readHudVisibleDuringScreenShare(): boolean {
  try {
    const raw = localStorage.getItem(VOICE_HUD_SCREEN_SHARE_VISIBLE_STORAGE_KEY)
    if (raw === '0' || raw === 'false') return false
    if (raw === '1' || raw === 'true') return true
  } catch {
    /* private mode */
  }
  return false
}

export function writeHudVisibleDuringScreenShare(visible: boolean) {
  try {
    localStorage.setItem(VOICE_HUD_SCREEN_SHARE_VISIBLE_STORAGE_KEY, visible ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function isHudScreenShareVisibleSyncEvent(event: StorageEvent): boolean {
  return event.key === VOICE_HUD_SCREEN_SHARE_VISIBLE_STORAGE_KEY
}

export async function applyHudVisibleDuringScreenShareToElectron(visible: boolean): Promise<void> {
  if (typeof window === 'undefined') return
  const api = window.veennaElectron?.setHudVisibleDuringScreenShare
  if (!api) return
  const result = await api(visible)
  if (result?.ok === false) {
    const reason =
      typeof (result as { reason?: string }).reason === 'string'
        ? ((result as { reason?: string }).reason as string)
        : 'Could not update screen share HUD visibility.'
    throw new Error(reason)
  }
}
