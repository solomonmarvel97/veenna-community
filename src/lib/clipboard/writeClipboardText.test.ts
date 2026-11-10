import { afterEach, describe, expect, it, vi } from 'vitest'
import { writeClipboardText } from './writeClipboardText'

describe('writeClipboardText', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(window, 'veennaElectron')
  })

  it('returns false for empty text', async () => {
    expect(await writeClipboardText('')).toBe(false)
    expect(await writeClipboardText('   '.trim())).toBe(false)
  })

  it('uses Electron copyText when available', async () => {
    window.veennaElectron = {
      isElectron: true,
      copyText: vi.fn(async () => ({ ok: true })),
    }

    await expect(writeClipboardText('hello')).resolves.toBe(true)
    expect(window.veennaElectron.copyText).toHaveBeenCalledWith('hello')
  })

  it('falls back to navigator.clipboard when Electron copy fails', async () => {
    window.veennaElectron = {
      isElectron: true,
      copyText: vi.fn(async () => ({ ok: false, reason: 'untrusted_sender' })),
    }
    const writeText = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await expect(writeClipboardText('hello')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })
})
