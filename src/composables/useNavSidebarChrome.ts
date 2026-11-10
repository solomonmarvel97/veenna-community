import { computed, ref, watch, type Ref } from 'vue'
import { useResponsiveLayout } from '@/composables/useResponsiveLayout'
import { isElectronMainWindow } from '@/lib/platform/isElectron'

export const NAV_SIDEBAR_MIN_WIDTH = 180
export const NAV_SIDEBAR_MAX_WIDTH = 224
export const NAV_SIDEBAR_DEFAULT_WIDTH = 208
export const NAV_SIDEBAR_COLLAPSED_WIDTH = 56
const COLLAPSE_DRAG_SLACK = 32

const WIDTH_KEY = 'veenna.nav.width'

function clampWidth(next: number): number {
  return Math.min(NAV_SIDEBAR_MAX_WIDTH, Math.max(NAV_SIDEBAR_MIN_WIDTH, Math.round(next)))
}

function readStoredWidth(): number {
  if (typeof localStorage === 'undefined') return NAV_SIDEBAR_DEFAULT_WIDTH
  try {
    const raw = localStorage.getItem(WIDTH_KEY)
    if (!raw) return NAV_SIDEBAR_DEFAULT_WIDTH
    const n = Number(raw)
    if (!Number.isFinite(n)) return NAV_SIDEBAR_DEFAULT_WIDTH
    return clampWidth(n)
  } catch {
    return NAV_SIDEBAR_DEFAULT_WIDTH
  }
}

function writeStoredWidth(width: number) {
  try {
    localStorage.setItem(WIDTH_KEY, String(width))
  } catch {
    /* ignore quota / private mode */
  }
}

function createNavSidebarChrome() {
  const { isMobile } = useResponsiveLayout()
  const width = ref(readStoredWidth())
  // The nav always opens expanded; collapsing lasts until the app is reopened.
  const collapsed = ref(false)
  /** The desktop app keeps the nav beside the page at any window size; only the owner collapses it. */
  const docked = computed(() => isElectronMainWindow || !isMobile.value)
  const iconRail = computed(() => collapsed.value && docked.value)
  if (isElectronMainWindow) {
    // The desktop window may only get as narrow as the nav's state allows.
    watch(
      collapsed,
      (next) => {
        void window.veennaElectron?.setNavCollapsed?.(next)?.catch(() => {})
      },
      { immediate: true },
    )
  }
  const resizing = ref(false)
  const widthStyle = computed(() => ({
    width: `${iconRail.value ? NAV_SIDEBAR_COLLAPSED_WIDTH : width.value}px`,
  }))
  /**
   * How far a viewport overlay must start so it covers the main pane and
   * never the nav. Mobile uses a drawer, so the inset is 0.
   */
  const overlayInset = computed(() => {
    if (!docked.value) return 0
    return iconRail.value ? NAV_SIDEBAR_COLLAPSED_WIDTH : width.value
  })

  let dragStartX = 0
  let dragStartWidth = 0
  let activePointerId: number | null = null

  function persistWidth() {
    writeStoredWidth(width.value)
  }

  function onPointerMove(event: PointerEvent) {
    if (activePointerId !== event.pointerId) return
    const next = dragStartWidth + (event.clientX - dragStartX)
    if (collapsed.value) {
      if (next >= NAV_SIDEBAR_MIN_WIDTH) {
        setCollapsed(false)
        width.value = clampWidth(next)
      }
      return
    }
    if (next < NAV_SIDEBAR_MIN_WIDTH - COLLAPSE_DRAG_SLACK) {
      setCollapsed(true)
      return
    }
    width.value = clampWidth(next)
  }

  function endResize(event?: PointerEvent) {
    if (event && activePointerId !== null && event.pointerId !== activePointerId) return
    activePointerId = null
    resizing.value = false
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', endResize)
    window.removeEventListener('pointercancel', endResize)
    persistWidth()
    document.body.style.removeProperty('cursor')
    document.body.style.removeProperty('user-select')
  }

  function startResize(event: PointerEvent) {
    if (event.button !== 0) return
    event.preventDefault()
    activePointerId = event.pointerId
    dragStartX = event.clientX
    dragStartWidth = collapsed.value ? NAV_SIDEBAR_COLLAPSED_WIDTH : width.value
    resizing.value = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', endResize)
    window.addEventListener('pointercancel', endResize)
  }

  function resetWidth() {
    width.value = NAV_SIDEBAR_DEFAULT_WIDTH
    persistWidth()
  }

  function setCollapsed(next: boolean) {
    collapsed.value = next
  }

  function toggleCollapsed() {
    setCollapsed(!collapsed.value)
  }

  return {
    collapsed,
    docked,
    iconRail,
    expanded: computed(() => !collapsed.value),
    width,
    widthStyle,
    overlayInset,
    resizing,
    startResize,
    resetWidth,
    setCollapsed,
    toggleCollapsed,
    collapsedWidth: NAV_SIDEBAR_COLLAPSED_WIDTH,
    minWidth: NAV_SIDEBAR_MIN_WIDTH,
    maxWidth: NAV_SIDEBAR_MAX_WIDTH,
  }
}

type NavSidebarChrome = {
  collapsed: Ref<boolean>
  docked: Ref<boolean>
  iconRail: Ref<boolean>
  expanded: Ref<boolean>
  width: Ref<number>
  widthStyle: Ref<{ width: string }>
  overlayInset: Ref<number>
  resizing: Ref<boolean>
  startResize: (event: PointerEvent) => void
  resetWidth: () => void
  setCollapsed: (next: boolean) => void
  toggleCollapsed: () => void
  collapsedWidth: number
  minWidth: number
  maxWidth: number
}

let chrome: NavSidebarChrome | null = null

export function useNavSidebarChrome(): NavSidebarChrome {
  if (!chrome) chrome = createNavSidebarChrome()
  return chrome
}

/** Test-only: drop the singleton so the next call hydrates from storage again. */
export function resetNavSidebarChromeForTests() {
  chrome = null
}
