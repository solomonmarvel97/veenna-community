import { onScopeDispose, ref } from 'vue'
import { useRouter } from 'vue-router'

/**
 * Back/forward for the app's own pages. vue-router keeps `back` and `forward`
 * in each history entry's state, so we read that after every navigation
 * (pushes, replaces and popstate all land in afterEach) instead of guessing.
 */
export function useRouterHistoryNav() {
  const router = useRouter()
  const canGoBack = ref(false)
  const canGoForward = ref(false)

  function sync() {
    const state = router.options.history.state as { back?: unknown; forward?: unknown } | null
    canGoBack.value = Boolean(state?.back)
    canGoForward.value = Boolean(state?.forward)
  }

  sync()
  const stop = router.afterEach(() => sync())
  onScopeDispose(stop)

  return {
    canGoBack,
    canGoForward,
    back: () => {
      if (canGoBack.value) router.back()
    },
    forward: () => {
      if (canGoForward.value) router.forward()
    },
  }
}
