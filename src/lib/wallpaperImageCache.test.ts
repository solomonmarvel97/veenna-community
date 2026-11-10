import { afterEach, describe, expect, it, vi } from 'vitest'

const matchResponses = new Map<string, Response>()

vi.stubGlobal('caches', {
  open: async () => ({
    match: async (url: string) => matchResponses.get(url)?.clone() ?? null,
    put: async (url: string, response: Response) => {
      matchResponses.set(url, response)
    },
    delete: async (url: string) => matchResponses.delete(url),
  }),
})

import { resolveWallpaperDisplayUrl } from './wallpaperImageCache'

describe('resolveWallpaperDisplayUrl', () => {
  afterEach(() => {
    matchResponses.clear()
    vi.unstubAllGlobals()
    vi.stubGlobal('caches', {
      open: async () => ({
        match: async (url: string) => matchResponses.get(url)?.clone() ?? null,
        put: async (url: string, response: Response) => {
          matchResponses.set(url, response)
        },
        delete: async (url: string) => matchResponses.delete(url),
      }),
    })
  })

  it('returns a cached blob URL when available', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const url =
      'https://images.pexels.com/photos/1/pexels-photo-1.jpeg?auto=compress&cs=srgb&dpr=2&w=1920&h=1080&fit=crop'
    matchResponses.set(url, new Response(new Blob(['img'], { type: 'image/jpeg' })))

    const result = await resolveWallpaperDisplayUrl(url)
    expect(result.fromCache).toBe(true)
    expect(result.displayUrl?.startsWith('blob:')).toBe(true)
  })

  it('does not fall back to a live network URL while offline', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const url =
      'https://images.pexels.com/photos/2/pexels-photo-2.jpeg?auto=compress&cs=srgb&dpr=2&w=1920&h=1080&fit=crop'

    const result = await resolveWallpaperDisplayUrl(url)
    expect(result.fromCache).toBe(false)
    expect(result.displayUrl).toBeNull()
  })

  it('warms cache without revoking an existing display blob URL', async () => {
    const { persistWallpaperImage, resolveWallpaperDisplayUrl: resolve } =
      await import('./wallpaperImageCache')
    vi.stubGlobal('navigator', { onLine: true })
    const first =
      'https://images.pexels.com/photos/10/pexels-photo-10.jpeg?auto=compress&cs=srgb&dpr=2&w=1920&h=1080&fit=crop'
    const second =
      'https://images.pexels.com/photos/20/pexels-photo-20.jpeg?auto=compress&cs=srgb&dpr=2&w=1920&h=1080&fit=crop'

    matchResponses.set(first, new Response(new Blob(['a'], { type: 'image/jpeg' })))
    const shown = await resolve(first)
    expect(shown.displayUrl?.startsWith('blob:')).toBe(true)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Blob(['b'], { type: 'image/jpeg' }))),
    )
    const warmed = await persistWallpaperImage(second)
    expect(warmed).toBe(second)
    // Live display blob must still be usable after a background cache warm.
    expect(shown.displayUrl?.startsWith('blob:')).toBe(true)
  })

  it('stores and prepares a WebP copy no wider than the cap', async () => {
    const { persistWallpaperImage, takePreparedWallpaperUrl } =
      await import('./wallpaperImageCache')
    vi.stubGlobal('navigator', { onLine: true })
    vi.stubGlobal('screen', { width: 1512 })
    vi.stubGlobal('devicePixelRatio', 2)
    const drawn: number[][] = []
    vi.stubGlobal('createImageBitmap', async () => ({ width: 3840, height: 2160, close: vi.fn() }))
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        constructor(
          public width: number,
          public height: number,
        ) {}
        getContext() {
          return { drawImage: (_b: unknown, ...box: number[]) => drawn.push(box) }
        }
        async convertToBlob(opts: { type: string }) {
          return new Blob(['webp'], { type: opts.type })
        }
      },
    )
    const fetchMock = vi.fn(
      async () => new Response(new Blob(['a much heavier jpeg'], { type: 'image/jpeg' })),
    )
    vi.stubGlobal('fetch', fetchMock)
    const url =
      'https://images.pexels.com/photos/30/pexels-photo-30.jpeg?auto=compress&cs=srgb&dpr=2&w=1920&h=1080&fit=crop'

    expect(await persistWallpaperImage(url)).toBe(url)

    const stored = await matchResponses.get(url)!.blob()
    expect(stored.type).toBe('image/webp')
    expect(drawn[0]).toEqual([0, 0, 2560, 1440])
    const prepared = takePreparedWallpaperUrl(url)
    expect(prepared?.startsWith('blob:')).toBe(true)
    // Handed over once; the next apply must not reuse it.
    expect(takePreparedWallpaperUrl(url)).toBeNull()
  })

  it('converts a wallpaper cached before compression the next time it is persisted', async () => {
    const { persistWallpaperImage } = await import('./wallpaperImageCache')
    vi.stubGlobal('createImageBitmap', async () => ({ width: 1000, height: 500, close: vi.fn() }))
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        constructor(
          public width: number,
          public height: number,
        ) {}
        getContext() {
          return { drawImage: vi.fn() }
        }
        async convertToBlob(opts: { type: string }) {
          return new Blob(['w'], { type: opts.type })
        }
      },
    )
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const url =
      'https://images.pexels.com/photos/40/pexels-photo-40.jpeg?auto=compress&cs=srgb&dpr=2&w=1920&h=1080&fit=crop'
    matchResponses.set(url, new Response(new Blob(['old jpeg'], { type: 'image/jpeg' })))

    await persistWallpaperImage(url)

    expect(fetchMock).not.toHaveBeenCalled()
    expect((await matchResponses.get(url)!.blob()).type).toBe('image/webp')
  })
})
