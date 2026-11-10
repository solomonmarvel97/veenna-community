import { onMounted, onUnmounted, ref } from 'vue'
import { useMessageToast } from '@/composables/useMessageToast'
import { getVeennaElectron } from '@/lib/platform/isElectron'

/**
 * Tell the owner when push-to-talk cannot hear the Option key being let go.
 *
 * The key monitor needs Input Monitoring to see the release. macOS ties that
 * grant to the app's signature, and an ad-hoc build gets a new one with every
 * install: Settings still shows veenna switched on, but the grant belongs to
 * the old build, so the HUD starts on press and never stops. Switching veenna
 * off and on again writes a grant for this build; the monitor notices it and
 * restarts itself. So once the monitor is up without the grant, say that, with
 * a button straight to the pane. Once per launch, from the main window only.
 */

const POLL_MS = 2000
/** The monitor reports within a few seconds of launch; past this, stop asking. */
const GIVE_UP_MS = 60_000

let shownThisLaunch = false

export function useInputMonitoringNotice() {
  const electron = getVeennaElectron()
  const notice = ref<string | null>(null)
  let timer: ReturnType<typeof setInterval> | null = null
  let startedAt = 0

  useMessageToast(notice, {
    title: 'Push-to-talk can’t hear the key being released',
    variant: 'warning',
    duration: 20_000,
    actionLabel: 'Open Input Monitoring',
    onAction: () => void electron?.openInputMonitoringSettings?.(),
  })

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
  }

  async function check() {
    if (shownThisLaunch || Date.now() - startedAt > GIVE_UP_MS) return stop()
    const status = await electron?.getDictationAccessibility?.().catch(() => undefined)
    if (!status) return
    if (!status.required) return stop()
    if (!status.monitorReady) return
    stop()
    if (status.inputMonitoring) return
    shownThisLaunch = true
    notice.value =
      'In Input Monitoring, switch veenna off and on again (or on, if it’s off). A new install needs this until the app is signed with a stable certificate.'
  }

  onMounted(() => {
    if (shownThisLaunch || !electron?.getDictationAccessibility) return
    startedAt = Date.now()
    timer = setInterval(() => void check(), POLL_MS)
    void check()
  })

  onUnmounted(stop)
}
