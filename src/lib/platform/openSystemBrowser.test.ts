import { afterEach, describe, expect, it, vi } from 'vitest'
import { openSystemBrowser } from './openSystemBrowser'

describe('openSystemBrowser', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(window, 'veennaElectron')
  })

  it('opens http(s) URLs through Electron instead of window.open', async () => {
    const openExternalUrl = vi.fn(async () => ({ ok: true }))
    window.veennaElectron = {
      isElectron: true,
      openExternalUrl,
    }
    const open = vi.fn()
    vi.stubGlobal('open', open)

    await openSystemBrowser('https://connect.composio.dev/auth')
    expect(openExternalUrl).toHaveBeenCalledWith('https://connect.composio.dev/auth')
    expect(open).not.toHaveBeenCalled()
  })

  it('falls back to window.open outside Electron', async () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)
    await openSystemBrowser('https://example.com/oauth')
    expect(open).toHaveBeenCalledWith('https://example.com/oauth', '_blank', 'noopener,noreferrer')
  })

  it('rejects non-http URLs', async () => {
    await expect(openSystemBrowser('file:///etc/passwd')).rejects.toThrow(
      'Could not open that page.',
    )
    await expect(openSystemBrowser('not a url')).rejects.toThrow('Could not open that page.')
  })
})
