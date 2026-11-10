import { afterEach, describe, expect, it, vi } from 'vitest'
import { writeMotionEnabled } from '@/lib/motionPreferences'
import { applyMotionDomFlags, isMotionEnabled, isReducedMotion } from '@/motion/reducedMotion'

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
}

describe('motion preferences', () => {
  afterEach(() => {
    delete document.documentElement.dataset.reducedMotion
    delete document.documentElement.dataset.motionDev
    delete document.documentElement.dataset.animations
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('is on by default', () => {
    stubMatchMedia(false)
    applyMotionDomFlags()
    expect(isMotionEnabled()).toBe(true)
    expect(isReducedMotion()).toBe(false)
    expect(document.documentElement.dataset.animations).toBe('on')
    expect(document.documentElement.dataset.motionDev).toBe('on')
  })

  it('is off once the user turned animations off', () => {
    stubMatchMedia(false)
    writeMotionEnabled(false)
    applyMotionDomFlags()
    expect(isMotionEnabled()).toBe(false)
    expect(isReducedMotion()).toBe(true)
    expect(document.documentElement.dataset.animations).toBe('off')
  })

  it('turns on with the Animations switch', () => {
    stubMatchMedia(false)
    writeMotionEnabled(true)
    applyMotionDomFlags()
    expect(isMotionEnabled()).toBe(true)
    expect(isReducedMotion()).toBe(false)
    expect(document.documentElement.dataset.motionDev).toBe('on')
  })

  it('lets prefers-reduced-motion override the switch', () => {
    stubMatchMedia(true)
    writeMotionEnabled(true)
    applyMotionDomFlags()
    expect(document.documentElement.dataset.reducedMotion).toBe('true')
    expect(isMotionEnabled()).toBe(false)
    expect(document.documentElement.dataset.animations).toBe('off')
  })
})
