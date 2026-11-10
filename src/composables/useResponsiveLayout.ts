import { computed, ref } from 'vue'
import { MOBILE_MAX } from '@/lib/platform'

export { MOBILE_MAX }
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
const navDrawerOpen = ref(false)
let listenerAttached = false

function syncViewport() {
  viewportWidth.value = window.innerWidth
  if (viewportWidth.value > MOBILE_MAX) navDrawerOpen.value = false
}

function attachViewportListener() {
  if (listenerAttached || typeof window === 'undefined') return
  listenerAttached = true
  syncViewport()
  window.addEventListener('resize', syncViewport, { passive: true })
}

/**
 * Layout chrome (drawer, mobile top bar) follows viewport width so it stays
 * aligned with Tailwind `lg` / `max-lg`. Guest-session Electron exceptions live
 * in `isMobileViewport()` - do not reintroduce them here or the drawer close
 * button appears (CSS) while never sliding the panel away (JS).
 */
export function useResponsiveLayout() {
  attachViewportListener()

  const isMobile = computed(() => viewportWidth.value <= MOBILE_MAX)
  const isDesktop = computed(() => viewportWidth.value > MOBILE_MAX)

  function openNav() {
    navDrawerOpen.value = true
  }

  function closeNav() {
    navDrawerOpen.value = false
  }

  function toggleNav() {
    navDrawerOpen.value = !navDrawerOpen.value
  }

  return {
    isMobile,
    isDesktop,
    navOpen: navDrawerOpen,
    openNav,
    closeNav,
    toggleNav,
  }
}
