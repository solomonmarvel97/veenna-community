import { computed, ref } from 'vue'

/** How long the "paste had no target" card stays before it dismisses itself. */
const AUTO_DISMISS_MS = 12_000
const TICK_MS = 40

/**
 * The auto-dismiss countdown behind the paste-fallback card. It runs down from AUTO_DISMISS_MS
 * and can be paused two ways: while the pointer hovers the card, or pinned with the pause button.
 *
 * @param onExpire called once when the countdown reaches zero
 */
export function usePasteFallbackCountdown(onExpire: () => void) {
  /** Percent of the countdown left, for the progress bar. */
  const progress = ref(100)
  const hoverPaused = ref(false)
  const pinnedPaused = ref(false)
  const paused = computed(() => pinnedPaused.value || hoverPaused.value)

  let timer: ReturnType<typeof setInterval> | null = null
  let remainingMs = AUTO_DISMISS_MS
  let lastTickAt = 0

  function syncProgress() {
    progress.value = Math.max(0, (remainingMs / AUTO_DISMISS_MS) * 100)
  }

  /** Take the time since the last tick off the clock. */
  function flushElapsed() {
    const now = Date.now()
    remainingMs = Math.max(0, remainingMs - (now - lastTickAt))
    lastTickAt = now
    syncProgress()
  }

  function expireIfDone() {
    if (remainingMs <= 0) onExpire()
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
    remainingMs = AUTO_DISMISS_MS
    lastTickAt = 0
    hoverPaused.value = false
    pinnedPaused.value = false
  }

  function start() {
    stop()
    lastTickAt = Date.now()
    syncProgress()
    timer = setInterval(() => {
      if (paused.value) return
      flushElapsed()
      expireIfDone()
    }, TICK_MS)
  }

  function pauseOnHover() {
    if (paused.value || !timer) return
    flushElapsed()
    hoverPaused.value = true
  }

  function resumeOnLeave() {
    if (pinnedPaused.value || !hoverPaused.value || !timer) return
    hoverPaused.value = false
    lastTickAt = Date.now()
    expireIfDone()
  }

  function togglePinned() {
    if (!timer) return
    if (pinnedPaused.value) {
      pinnedPaused.value = false
      hoverPaused.value = false
      lastTickAt = Date.now()
      expireIfDone()
      return
    }
    flushElapsed()
    pinnedPaused.value = true
    hoverPaused.value = false
  }

  return { progress, paused, pinnedPaused, start, stop, pauseOnHover, resumeOnLeave, togglePinned }
}
