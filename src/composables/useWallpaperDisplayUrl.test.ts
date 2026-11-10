import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

const resolveWallpaperDisplayUrl = vi.fn()
const takePreparedWallpaperUrl = vi.fn()

vi.mock('@/lib/wallpaperImageCache', () => ({
  resolveWallpaperDisplayUrl: (...args: unknown[]) => resolveWallpaperDisplayUrl(...args),
  takePreparedWallpaperUrl: (...args: unknown[]) => takePreparedWallpaperUrl(...args),
  persistWallpaperImage: vi.fn().mockResolvedValue(null),
  clearPersistedWallpaper: vi.fn(),
}))

vi.mock('@/api/veennas', () => ({
  veennasApi: {
    updateSettings: vi.fn().mockResolvedValue({}),
  },
}))

import { useThemeStore } from '@/stores/theme'
import {
  __resetWallpaperDisplayUrlForTests,
  useWallpaperDisplayUrl,
} from '@/composables/useWallpaperDisplayUrl'

describe('useWallpaperDisplayUrl', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    __resetWallpaperDisplayUrlForTests()
    resolveWallpaperDisplayUrl.mockReset()
    takePreparedWallpaperUrl.mockReset().mockReturnValue(null)
    vi.stubGlobal('navigator', { onLine: true })
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
  })

  afterEach(() => {
    __resetWallpaperDisplayUrlForTests()
  })

  it('applies the network wallpaper immediately before cache resolve finishes', async () => {
    let finishResolve: (value: { displayUrl: string | null; fromCache: boolean }) => void = () =>
      undefined
    resolveWallpaperDisplayUrl.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishResolve = resolve
        }),
    )

    const theme = useThemeStore()
    const { displayUrl } = useWallpaperDisplayUrl()

    const next =
      'https://images.pexels.com/photos/999/pexels-photo-999.jpeg?auto=compress&cs=srgb&dpr=2&w=1920&h=1080&fit=crop'
    theme.setBackgroundUrl(next, { animate: false, persist: false })
    await nextTick()

    expect(displayUrl.value).toContain('/photos/999/')

    finishResolve({ displayUrl: 'blob:wallpaper-cached', fromCache: true })
    await Promise.resolve()
    expect(displayUrl.value).toBe('blob:wallpaper-cached')
  })

  it('paints the compressed copy the apply prepared instead of the network original', async () => {
    resolveWallpaperDisplayUrl.mockReturnValue(new Promise(() => undefined))
    takePreparedWallpaperUrl.mockReturnValue('blob:wallpaper-webp')

    const theme = useThemeStore()
    const { displayUrl } = useWallpaperDisplayUrl()

    theme.setBackgroundUrl(
      'https://images.pexels.com/photos/777/pexels-photo-777.jpeg?auto=compress&cs=srgb&dpr=2&w=1920&h=1080&fit=crop',
      { animate: false, persist: false },
    )
    await nextTick()

    expect(displayUrl.value).toBe('blob:wallpaper-webp')
  })

  it('recovers to the network URL when cache resolve has nothing offline-safe', async () => {
    resolveWallpaperDisplayUrl.mockResolvedValue({ displayUrl: null, fromCache: false })

    const theme = useThemeStore()
    const { displayUrl, recoverFromLoadError } = useWallpaperDisplayUrl()

    const next =
      'https://images.pexels.com/photos/888/pexels-photo-888.jpeg?auto=compress&cs=srgb&dpr=2&w=1920&h=1080&fit=crop'
    theme.setBackgroundUrl(next, { animate: false, persist: false })
    await nextTick()

    const recovered = await recoverFromLoadError()
    expect(recovered).toBe(true)
    expect(displayUrl.value).toContain('/photos/888/')
  })
})
