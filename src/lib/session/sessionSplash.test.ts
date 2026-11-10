import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  consumeSessionSplashPending,
  hideSessionSplash,
  holdShareSplash,
  markSessionSplashPending,
  parkBootSplash,
  releaseShareSplash,
  shareSplashHeld,
  showSessionSplash,
  withinSplashBudget,
} from '@/lib/session/sessionSplash'

describe('session splash', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="boot-splash"></div>'
    sessionStorage.clear()
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
      cb()
      return 0
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('parks the boot splash and brings the same node back', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const node = document.getElementById('boot-splash')
    parkBootSplash()
    expect(document.getElementById('boot-splash')).toBeNull()
    showSessionSplash()
    expect(document.getElementById('boot-splash')).toBe(node)
    expect(node?.className).toBe('is-visible')
    hideSessionSplash()
    expect(document.getElementById('boot-splash')).toBeNull()
  })

  it('takes a showing splash off screen in one frame, no fade over the app', () => {
    const node = document.getElementById('boot-splash')
    node?.classList.add('is-visible')
    hideSessionSplash()
    expect(document.getElementById('boot-splash')).toBeNull()
    expect(node?.className).toBe('')
  })

  it('removes a splash at once when its content never showed', () => {
    hideSessionSplash()
    expect(document.getElementById('boot-splash')).toBeNull()
  })

  it('drops the share look when an account change reuses the splash', () => {
    document.getElementById('boot-splash')?.setAttribute('data-variant', 'share')
    parkBootSplash()
    showSessionSplash()
    expect(document.getElementById('boot-splash')?.hasAttribute('data-variant')).toBe(false)
  })

  it('holds a share link splash until the page has loaded', async () => {
    document.getElementById('boot-splash')?.setAttribute('data-variant', 'share')
    expect(holdShareSplash()).toBe(true)
    expect(shareSplashHeld.value).toBe(true)
    expect(document.getElementById('boot-splash')).not.toBeNull()
    releaseShareSplash()
    await nextTick()
    expect(shareSplashHeld.value).toBe(false)
    expect(document.getElementById('boot-splash')).toBeNull()
  })

  it('hands a share load that never settles to the page after the budget', async () => {
    vi.useFakeTimers()
    document.getElementById('boot-splash')?.setAttribute('data-variant', 'share')
    holdShareSplash(1000)
    await vi.advanceTimersByTimeAsync(1000)
    await nextTick()
    expect(shareSplashHeld.value).toBe(false)
    expect(document.getElementById('boot-splash')).toBeNull()
  })

  it('holds nothing off a share link', () => {
    expect(holdShareSplash()).toBe(false)
    expect(shareSplashHeld.value).toBe(false)
  })

  it('reports a marked reload exactly once', () => {
    expect(consumeSessionSplashPending()).toBe(false)
    markSessionSplashPending()
    expect(consumeSessionSplashPending()).toBe(true)
    expect(consumeSessionSplashPending()).toBe(false)
  })

  it('stops waiting when the budget runs out', async () => {
    vi.useFakeTimers()
    let done = false
    const waiting = withinSplashBudget(new Promise(() => undefined), 500).then(() => {
      done = true
    })
    await vi.advanceTimersByTimeAsync(499)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    await waiting
    expect(done).toBe(true)
  })

  it('resolves early, and quietly, when the work fails', async () => {
    await expect(withinSplashBudget(Promise.reject(new Error('x')), 5000)).resolves.toBeUndefined()
  })
})
