import { describe, expect, it } from 'vitest'
import {
  inferUsageCategory,
  inAppDictationContext,
  isSelfForegroundApp,
  normalizeForegroundContext,
  toAppContextPayload,
} from '@/lib/dictation/appContext'
import { writePrivacySettings } from '@/lib/privacySettings'

describe('appContext', () => {
  it('treats veenna and electron as self apps', () => {
    expect(isSelfForegroundApp('veenna')).toBe(true)
    expect(isSelfForegroundApp('Electron')).toBe(true)
    expect(isSelfForegroundApp('Google Chrome')).toBe(false)
  })

  it('drops self apps from OS foreground snapshots', () => {
    expect(normalizeForegroundContext({ appName: 'Electron' }, 'os')).toBeNull()
    expect(
      normalizeForegroundContext({ appName: 'Visual Studio Code', windowTitle: 'main.ts' }, 'os'),
    ).toMatchObject({ appName: 'Visual Studio Code', windowTitle: 'main.ts' })
  })

  it('infers categories locally without persisting window titles', () => {
    expect(inferUsageCategory('Google Chrome', 'Inbox - Gmail')).toBe('email')
    expect(inferUsageCategory('Google Chrome', 'Random blog post')).toBe('other')
    expect(inferUsageCategory('Code', 'main.ts - project')).toBe('work')
  })

  it('maps foreground context to a privacy-safe API payload', () => {
    const payload = toAppContextPayload(
      normalizeForegroundContext({ appName: 'Google Chrome', windowTitle: 'Inbox - Gmail' }, 'os'),
    )
    expect(payload).toEqual({
      appContext: 'Google Chrome',
      appCategory: 'email',
    })
    expect(payload).not.toHaveProperty('appWindowTitle')
  })

  it('excludes in-app veenna dictation from desktop usage', () => {
    expect(toAppContextPayload(inAppDictationContext())).toEqual({
      appContext: null,
      appCategory: null,
    })
  })

  it('returns empty payload when context awareness is disabled', () => {
    writePrivacySettings({ contextAwareness: false })
    const payload = toAppContextPayload(
      normalizeForegroundContext({ appName: 'Google Chrome', windowTitle: 'Inbox - Gmail' }, 'os'),
    )
    expect(payload).toEqual({ appContext: null, appCategory: null })
    writePrivacySettings({ contextAwareness: true })
  })
})
