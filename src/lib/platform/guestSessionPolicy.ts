import { isElectron, isElectronMainWindow } from './isElectron'

/** Matches Tailwind `lg` and mobile chrome breakpoints. */
export const MOBILE_MAX = 1023

export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  if (isElectronMainWindow) return false
  return window.innerWidth <= MOBILE_MAX
}

/** Guest and signed-out local sessions are allowed on Electron and mobile web only. */
export function allowsGuestSession(): boolean {
  return isElectron || isMobileViewport()
}
