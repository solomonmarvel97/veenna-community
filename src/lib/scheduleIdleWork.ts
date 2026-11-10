type IdleWorkOptions = { timeoutMs?: number; delayMs?: number }

/** Run work after the browser is idle so clicks and route changes stay instant. */
export function scheduleIdleWork(work: () => void, opts?: IdleWorkOptions) {
  const timeout = opts?.timeoutMs ?? 1500
  const delay = opts?.delayMs ?? 0

  const run = () => {
    try {
      work()
    } catch {
      /* ignore deferred bootstrap failures */
    }
  }

  if (typeof window === 'undefined') {
    run()
    return
  }

  window.setTimeout(() => {
    // The page (or a test's DOM) can be torn down before the timer fires.
    if (typeof window === 'undefined') return
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout })
    } else {
      run()
    }
  }, delay)
}

/**
 * Wait until `element` is near the viewport, then run on idle.
 * First paint / clicks are not blocked by offscreen mermaid or similar work.
 */
export function scheduleVisibleIdleWork(
  element: Element | null | undefined,
  work: () => void,
  opts?: IdleWorkOptions & { rootMargin?: string },
): () => void {
  let cancelled = false
  let started = false
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null
  let io: IntersectionObserver | null = null

  const start = () => {
    if (cancelled || started) return
    started = true
    if (fallbackTimer) clearTimeout(fallbackTimer)
    io?.disconnect()
    scheduleIdleWork(() => {
      if (!cancelled) work()
    }, opts)
  }

  if (!element || typeof IntersectionObserver === 'undefined') {
    start()
    return () => {
      cancelled = true
    }
  }

  io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      start()
    },
    { rootMargin: opts?.rootMargin ?? '160px', threshold: 0.01 },
  )
  io.observe(element)
  fallbackTimer = setTimeout(start, Math.max(opts?.timeoutMs ?? 1500, 2200))

  return () => {
    cancelled = true
    if (fallbackTimer) clearTimeout(fallbackTimer)
    io?.disconnect()
  }
}
