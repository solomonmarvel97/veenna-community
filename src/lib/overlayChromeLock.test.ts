import { afterEach, describe, expect, it } from 'vitest'
import { acquireOverlayChromeLock, overlayChromeLocked } from '@/lib/overlayChromeLock'

describe('overlayChromeLock', () => {
  afterEach(() => {
    while (overlayChromeLocked()) {
      acquireOverlayChromeLock()()
    }
    document.body.classList.remove('veenna-chrome-locked')
  })

  it('toggles body class with ref count', () => {
    const releaseA = acquireOverlayChromeLock()
    expect(document.body.classList.contains('veenna-chrome-locked')).toBe(true)

    const releaseB = acquireOverlayChromeLock()
    releaseA()
    expect(document.body.classList.contains('veenna-chrome-locked')).toBe(true)

    releaseB()
    expect(document.body.classList.contains('veenna-chrome-locked')).toBe(false)
  })
})
