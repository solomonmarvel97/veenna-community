import { onBeforeUnmount, watch, type WatchSource } from 'vue'
import { acquireOverlayChromeLock } from '@/lib/overlayChromeLock'

/** Locks page chrome (scroll + backdrop blur) while an overlay is open. */
export function useOverlayChromeLock(open: WatchSource<boolean>) {
  let release: (() => void) | null = null

  watch(
    open,
    (isOpen) => {
      if (isOpen && !release) {
        release = acquireOverlayChromeLock()
        return
      }
      if (!isOpen && release) {
        release()
        release = null
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    release?.()
    release = null
  })
}
