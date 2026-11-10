import { afterEach, describe, expect, it } from 'vitest'
import { detectAppPlatform } from './appPlatform'

const originalUa = navigator.userAgent
const originalPlatform = navigator.platform

function stubNavigator(userAgent: string, platform: string) {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: userAgent })
  Object.defineProperty(navigator, 'platform', { configurable: true, value: platform })
}

afterEach(() => {
  Reflect.deleteProperty(window, 'veennaElectron')
  stubNavigator(originalUa, originalPlatform)
})

describe('detectAppPlatform', () => {
  it('uses the Electron platform when present', () => {
    window.veennaElectron = { platform: 'darwin' } as typeof window.veennaElectron
    stubNavigator('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32')
    expect(detectAppPlatform()).toEqual({ id: 'macos', label: 'macOS' })
  })

  it('detects Windows, Linux, and Android from the user agent', () => {
    stubNavigator('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32')
    expect(detectAppPlatform()).toEqual({ id: 'windows', label: 'Windows' })

    stubNavigator('Mozilla/5.0 (X11; Linux x86_64)', 'Linux x86_64')
    expect(detectAppPlatform()).toEqual({ id: 'linux', label: 'Linux' })

    stubNavigator('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 'Linux armv8l')
    expect(detectAppPlatform()).toEqual({ id: 'android', label: 'Android' })
  })
})
