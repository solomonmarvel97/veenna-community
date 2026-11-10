import { readMotionEnabled } from '@/lib/motionPreferences'

/** OS accessibility preference. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** The Animations switch in Appearance, mirrored to localStorage by the theme store. */
function userAnimationsEnabled(): boolean {
  return readMotionEnabled()
}

/** Sync html dataset flags for CSS + Motion.dev runtime checks. */
export function applyMotionDomFlags(): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  if (prefersReducedMotion()) root.dataset.reducedMotion = 'true'
  else delete root.dataset.reducedMotion

  // The OS accessibility setting always wins over the in-app switch.
  const on = userAnimationsEnabled() && !prefersReducedMotion()
  root.dataset.motionDev = on ? 'on' : 'off'
  root.dataset.animations = on ? 'on' : 'off'
  window.dispatchEvent(new CustomEvent('veenna:animations-changed', { detail: { enabled: on } }))
}

/** True when Motion.dev playback, scroll-reveal CSS and graph morphs should be suppressed. */
export function isReducedMotion(): boolean {
  return !isMotionEnabled()
}

export function isMotionEnabled(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.dataset.animations === 'on'
}
