const MOTION_ENABLED_STORAGE_KEY = 'veenna-motion-enabled'

/** The Animations switch. On unless the person turned it off. */
export function readMotionEnabled(): boolean {
  if (typeof localStorage === 'undefined') return true
  return localStorage.getItem(MOTION_ENABLED_STORAGE_KEY) !== '0'
}

export function writeMotionEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(MOTION_ENABLED_STORAGE_KEY, enabled ? '1' : '0')
}
