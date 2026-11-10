import { onBeforeUnmount, onMounted } from 'vue'

/**
 * Keep a permission status on screen honest while the user grants it
 * somewhere else.
 *
 * Granting happens in System Settings, outside this window, and takes as long
 * as it takes: finding veenna in the list, flipping the switch, typing a
 * password. Reading the status once right after opening Settings caught it
 * before any of that, so the row said "Not asked yet" long after the switch
 * was on. So the status is read again whenever this window comes back to the
 * front, and after `watch()`, every couple of seconds until `settled()` says
 * the grant arrived (or it has been long enough to stop trying).
 */

const POLL_MS = 1500
const GIVE_UP_MS = 3 * 60_000

export function usePermissionRecheck(refresh: () => unknown, settled: () => boolean) {
  let timer: ReturnType<typeof setInterval> | null = null
  let startedAt = 0

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
  }

  async function tick() {
    await refresh()
    if (settled() || Date.now() - startedAt > GIVE_UP_MS) stop()
  }

  /** Call after sending the user to grant something. */
  function watch() {
    startedAt = Date.now()
    if (timer) return
    timer = setInterval(() => void tick(), POLL_MS)
  }

  function onFront() {
    if (document.visibilityState !== 'visible') return
    void refresh()
  }

  onMounted(() => {
    window.addEventListener('focus', onFront)
    document.addEventListener('visibilitychange', onFront)
  })
  onBeforeUnmount(() => {
    stop()
    window.removeEventListener('focus', onFront)
    document.removeEventListener('visibilitychange', onFront)
  })

  return { watch, stop }
}
