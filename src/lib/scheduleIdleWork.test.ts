import { afterEach, describe, expect, it, vi } from 'vitest'
import { scheduleVisibleIdleWork } from '@/lib/scheduleIdleWork'

describe('scheduleVisibleIdleWork', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('runs on idle once the element intersects', () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestIdleCallback', undefined)
    const work = vi.fn()
    const element = document.createElement('div')
    let observer = null as { cb: IntersectionObserverCallback; disconnect: () => void } | null

    vi.stubGlobal(
      'IntersectionObserver',
      class {
        cb: IntersectionObserverCallback
        disconnect = vi.fn()
        observe = vi.fn()
        unobserve = vi.fn()
        constructor(cb: IntersectionObserverCallback) {
          this.cb = cb
          observer = { cb, disconnect: this.disconnect }
        }
      },
    )

    scheduleVisibleIdleWork(element, work, { timeoutMs: 50, delayMs: 0 })
    expect(work).not.toHaveBeenCalled()

    observer?.cb(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      observer as unknown as IntersectionObserver,
    )
    vi.runAllTimers()
    expect(work).toHaveBeenCalledTimes(1)
  })

  it('does not run after cancel', () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestIdleCallback', undefined)
    const work = vi.fn()
    const element = document.createElement('div')
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        disconnect = vi.fn()
        observe = vi.fn()
        unobserve = vi.fn()
      },
    )

    const stop = scheduleVisibleIdleWork(element, work, { timeoutMs: 50, delayMs: 0 })
    stop()
    vi.runAllTimers()
    expect(work).not.toHaveBeenCalled()
  })
})
