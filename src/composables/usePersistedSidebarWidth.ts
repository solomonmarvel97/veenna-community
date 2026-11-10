import { computed, onBeforeUnmount, ref, type Ref } from 'vue'

export type PersistedSidebarWidthOptions = {
  storageKey: string
  defaultWidth: number
  minWidth?: number
  maxWidth?: number
  /**
   * Extra cap as a fraction of the window (width for left/right, height for
   * bottom) so a panel cannot cover the whole workbench on a small display.
   */
  maxViewportRatio?: number
  /**
   * Dynamic ceiling (px), e.g. leave room for the main workbench when several
   * right docks are open. Applied on top of maxWidth / maxViewportRatio.
   */
  getMaxWidth?: () => number
  /**
   * Which edge the panel is anchored to. `left`/`right` drag horizontally and
   * size a width; `bottom` drags vertically and sizes a height.
   */
  side?: 'left' | 'right' | 'bottom'
}

function readStoredWidth(key: string, fallback: number, min: number, max: number): number {
  if (typeof localStorage === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const n = Number(raw)
    if (!Number.isFinite(n)) return fallback
    return Math.min(max, Math.max(min, Math.round(n)))
  } catch {
    return fallback
  }
}

function writeStoredWidth(key: string, width: number) {
  try {
    localStorage.setItem(key, String(width))
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Persist a list-sidebar pixel width so the right content pane can be expanded
 * by dragging the divider left (and restored across sessions).
 */
/** A bottom dock is sized by height; left/right docks by width. */
export type PanelSizeStyle = { width: string } | { height: string }

export function usePersistedSidebarWidth(opts: PersistedSidebarWidthOptions): {
  width: Ref<number>
  widthStyle: Ref<PanelSizeStyle>
  resizing: Ref<boolean>
  startResize: (event: PointerEvent) => void
  resetWidth: () => void
  /** Set (and save) a width, held to the allowed range. */
  setWidth: (next: number) => void
} {
  const minWidth = opts.minWidth ?? 180
  const maxWidth = opts.maxWidth ?? 480
  const side = opts.side ?? 'left'
  const vertical = side === 'bottom'

  function viewportCap() {
    if (typeof window === 'undefined' || !opts.maxViewportRatio) return maxWidth
    const axis = vertical ? window.innerHeight : window.innerWidth
    return Math.floor(axis * opts.maxViewportRatio)
  }

  function effectiveMax() {
    const configured = Math.min(maxWidth, viewportCap())
    const dynamic = opts.getMaxWidth?.()
    const capped =
      typeof dynamic === 'number' && Number.isFinite(dynamic)
        ? Math.min(configured, Math.floor(dynamic))
        : configured
    return Math.max(minWidth, capped)
  }

  const width = ref(readStoredWidth(opts.storageKey, opts.defaultWidth, minWidth, effectiveMax()))
  const resizing = ref(false)

  /** Pointer position on the axis being dragged. */
  let dragStartPos = 0
  let dragStartWidth = 0
  let activePointerId: number | null = null

  function clamp(next: number) {
    return Math.min(effectiveMax(), Math.max(minWidth, Math.round(next)))
  }

  /**
   * Fit the saved width to the room there is now, without saving the fit, so
   * the width the person chose comes back once the window has room again.
   */
  function recapToViewport() {
    if (resizing.value) return
    const preferred = readStoredWidth(opts.storageKey, opts.defaultWidth, minWidth, maxWidth)
    const next = clamp(preferred)
    if (next !== width.value) width.value = next
  }

  function persist() {
    writeStoredWidth(opts.storageKey, width.value)
  }

  function onPointerMove(event: PointerEvent) {
    if (activePointerId !== event.pointerId) return
    // Right and bottom docks grow as the pointer moves *toward* the origin,
    // because their anchored edge is the far one.
    const position = vertical ? event.clientY : event.clientX
    const delta = side === 'left' ? position - dragStartPos : dragStartPos - position
    width.value = clamp(dragStartWidth + delta)
  }

  function endResize(event?: Event) {
    if (
      event &&
      'pointerId' in event &&
      activePointerId !== null &&
      (event as PointerEvent).pointerId !== activePointerId
    ) {
      return
    }
    activePointerId = null
    resizing.value = false
    window.removeEventListener('pointermove', onPointerMove, true)
    window.removeEventListener('pointerup', endResize, true)
    window.removeEventListener('pointercancel', endResize, true)
    window.removeEventListener('mouseup', endResize, true)
    window.removeEventListener('blur', endResize)
    persist()
    document.body.style.removeProperty('cursor')
    document.body.style.removeProperty('user-select')
  }

  function startResize(event: PointerEvent) {
    if (event.button !== 0) return
    event.preventDefault()
    activePointerId = event.pointerId
    dragStartPos = vertical ? event.clientY : event.clientX
    dragStartWidth = width.value
    resizing.value = true
    document.body.style.cursor = vertical ? 'row-resize' : 'col-resize'
    document.body.style.userSelect = 'none'

    // Capture on the handle when available so release over iframes still ends the drag.
    const captureEl =
      event.currentTarget instanceof HTMLElement
        ? event.currentTarget
        : event.target instanceof HTMLElement
          ? event.target
          : null
    try {
      captureEl?.setPointerCapture?.(event.pointerId)
    } catch {
      /* ignore */
    }

    // Capture-phase window listeners as a fallback when pointer capture is unavailable.
    window.addEventListener('pointermove', onPointerMove, true)
    window.addEventListener('pointerup', endResize, true)
    window.addEventListener('pointercancel', endResize, true)
    window.addEventListener('mouseup', endResize, true)
    window.addEventListener('blur', endResize)
  }

  function resetWidth() {
    width.value = clamp(opts.defaultWidth)
    persist()
  }

  function setWidth(next: number) {
    width.value = clamp(next)
    persist()
  }

  const trackViewport = Boolean(opts.maxViewportRatio || opts.getMaxWidth)
  if (typeof window !== 'undefined' && trackViewport) {
    window.addEventListener('resize', recapToViewport)
    recapToViewport()
  }

  onBeforeUnmount(() => {
    endResize()
    if (typeof window !== 'undefined' && trackViewport) {
      window.removeEventListener('resize', recapToViewport)
    }
  })

  const widthStyle = computed(() =>
    vertical ? { height: `${width.value}px` } : { width: `${width.value}px` },
  )

  return {
    width,
    widthStyle,
    resizing,
    startResize,
    resetWidth,
    setWidth,
  }
}
