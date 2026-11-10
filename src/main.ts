import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { lazyPersist } from '@/lib/persist/piniaLazyPersist'
import App from './App.vue'
import router from './router'
import { initThemeBeforeMount, initHudSurfaceBeforeMount, initMotionBeforeMount } from '@/stores/theme'
import { isElectron, isDictationHudWindow } from '@/lib/platform/isElectron'
import { parkBootSplash } from '@/lib/session/sessionSplash'
import { loadPageCode } from '@/router/lazyPage'
import './styles/running-status-dots.css'
import './styles/hud-appearance.css'
import './style.css'

// Veenna Community: no server, no account, no telemetry. Boot is the theme, the router,
// and a local guest session, then the page.
initHudSurfaceBeforeMount()
initThemeBeforeMount()
initMotionBeforeMount()

/** Await a boot step, but never let it decide whether the app exists. */
async function settle(label: string, step: () => Promise<unknown>) {
  try {
    await step()
  } catch (error) {
    console.warn(`[boot] ${label} failed; continuing`, error)
  }
}

/** Start fetching the code of the page the window opens on, alongside boot. */
function prefetchLandingPage(): Promise<void> {
  if (isDictationHudWindow) return Promise.resolve()
  try {
    const target = router.resolve(window.location.pathname + window.location.search)
    const page = target.matched[target.matched.length - 1]?.components?.default
    return loadPageCode(page).catch(() => undefined)
  } catch {
    return Promise.resolve()
  }
}

/** How long mount waits on the landing page's code before showing its skeleton instead. */
const LANDING_PAGE_WAIT_MS = 1500

async function boot() {
  const landingPage = prefetchLandingPage()
  const app = createApp(App)
  const pinia = createPinia()
  pinia.use(lazyPersist)
  app.use(pinia)

  app.use(router)
  try {
    await router.isReady()
  } catch {
    // A guard that failed must never leave a dead window - mount anyway.
  }
  await Promise.race([
    landingPage,
    new Promise((resolve) => setTimeout(resolve, LANDING_PAGE_WAIT_MS)),
  ])

  // Dictation is on-device: load the bundled model now, not on the first key press.
  if (isElectron && !isDictationHudWindow) {
    void import('@/lib/voice/localStt').then(({ preloadGuestSttModel }) => preloadGuestSttModel())
  }

  try {
    app.mount('#app')
  } finally {
    // In the finally so a mount that throws still clears the splash.
    parkBootSplash()
  }
}

void boot().catch((error) => {
  console.error('[boot] failed', error)
  parkBootSplash()
})
