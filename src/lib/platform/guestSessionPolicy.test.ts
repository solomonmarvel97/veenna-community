import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./isElectron', () => ({
  isElectron: false,
  isElectronMainWindow: false,
}))

import { allowsGuestSession, isMobileViewport } from './guestSessionPolicy'

describe('guestSessionPolicy', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1280,
    })
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('treats desktop web viewports as auth-required', () => {
    expect(isMobileViewport()).toBe(false)
    expect(allowsGuestSession()).toBe(false)
  })

  it('allows guest sessions on mobile web viewports', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 768,
    })

    expect(isMobileViewport()).toBe(true)
    expect(allowsGuestSession()).toBe(true)
  })
})
