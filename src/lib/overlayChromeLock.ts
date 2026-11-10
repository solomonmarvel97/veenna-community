/**
 * Ref-counted body lock while overlays (modals, dictation, nav drawer, search) are open.
 * Prevents scroll and disables backdrop-filter stacks that shimmer in Chromium/Safari.
 */
let lockCount = 0

function syncBodyClass() {
  document.body.classList.toggle('veenna-chrome-locked', lockCount > 0)
}

export function acquireOverlayChromeLock(): () => void {
  lockCount += 1
  syncBodyClass()
  let released = false
  return () => {
    if (released) return
    released = true
    lockCount = Math.max(0, lockCount - 1)
    syncBodyClass()
  }
}

export function overlayChromeLocked(): boolean {
  return lockCount > 0
}
