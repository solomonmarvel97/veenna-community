/**
 * Persist applied wallpaper bytes in Cache Storage so app reloads
 * paint from local cache instead of re-fetching Pexels every launch.
 */

const CACHE_NAME = 'veenna-wallpaper-v1'
const META_KEY = 'veenna-wallpaper-cache-meta'

type WallpaperCacheMeta = {
  networkUrl: string
  cachedAt: number
}

/**
 * Wallpapers are stored and painted as WebP, never the raw download: Pexels
 * hands `fetch()` a 3840px JPEG of 1-1.5 MB. Past the display's own pixel
 * width, capped here, extra pixels only cost memory and decode time.
 */
const WALLPAPER_MAX_WIDTH = 2560
const WALLPAPER_WEBP_QUALITY = 0.75

let activeObjectUrl: string | null = null
/** Network URL the active blob URL was made for, so a re-resolve can reuse it. */
let activeNetworkUrl: string | null = null
/** Compressed wallpaper made ready by persist, waiting for the apply to adopt it. */
let prepared: { networkUrl: string; objectUrl: string } | null = null
const persisting = new Map<string, Promise<string | null>>()

function revokeActiveObjectUrl() {
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl)
    activeObjectUrl = null
  }
  activeNetworkUrl = null
}

function setActiveObjectUrl(networkUrl: string, objectUrl: string) {
  // Revoke only after the replacement exists so the live <img> never points at a dead blob.
  revokeActiveObjectUrl()
  activeObjectUrl = objectUrl
  activeNetworkUrl = networkUrl
}

function wallpaperTargetWidth() {
  const screenWidth =
    typeof screen !== 'undefined' && typeof devicePixelRatio === 'number'
      ? Math.round(screen.width * devicePixelRatio)
      : WALLPAPER_MAX_WIDTH
  return Math.min(WALLPAPER_MAX_WIDTH, screenWidth || WALLPAPER_MAX_WIDTH)
}

/**
 * Re-encode as WebP no wider than the display. Returns the input unchanged when
 * the browser cannot encode WebP or the result would not be smaller.
 */
async function compressWallpaperBlob(blob: Blob): Promise<Blob> {
  if (typeof createImageBitmap === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return blob
  }
  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(blob)
    const scale = Math.min(1, wallpaperTargetWidth() / bitmap.width)
    const canvas = new OffscreenCanvas(
      Math.round(bitmap.width * scale),
      Math.round(bitmap.height * scale),
    )
    const ctx = canvas.getContext('2d')
    if (!ctx) return blob
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const webp = await canvas.convertToBlob({
      type: 'image/webp',
      quality: WALLPAPER_WEBP_QUALITY,
    })
    if (webp.type !== 'image/webp') return blob
    return webp.size < blob.size || blob.type !== 'image/webp' ? webp : blob
  } catch {
    return blob
  } finally {
    bitmap?.close()
  }
}

function prepareDisplayBlob(networkUrl: string, blob: Blob) {
  if (activeNetworkUrl && sameWallpaperUrl(activeNetworkUrl, networkUrl)) return
  if (prepared) URL.revokeObjectURL(prepared.objectUrl)
  prepared = { networkUrl, objectUrl: URL.createObjectURL(blob) }
}

function readMeta(): WallpaperCacheMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WallpaperCacheMeta
    if (!parsed?.networkUrl?.startsWith('https://')) return null
    return parsed
  } catch {
    return null
  }
}

function writeMeta(networkUrl: string) {
  const meta: WallpaperCacheMeta = { networkUrl, cachedAt: Date.now() }
  localStorage.setItem(META_KEY, JSON.stringify(meta))
}

function clearMeta() {
  localStorage.removeItem(META_KEY)
}

async function openCache(): Promise<Cache | null> {
  if (typeof caches === 'undefined') return null
  try {
    return await caches.open(CACHE_NAME)
  } catch {
    return null
  }
}

async function putWallpaperBlob(networkUrl: string, blob: Blob): Promise<boolean> {
  const cache = await openCache()
  if (!cache) return false
  try {
    await cache.put(
      networkUrl,
      new Response(blob, { headers: { 'content-type': blob.type || 'image/webp' } }),
    )
    writeMeta(networkUrl)
    return true
  } catch {
    return false
  }
}

async function matchWallpaper(networkUrl: string): Promise<Response | null> {
  const cache = await openCache()
  if (!cache) return null
  try {
    return (await cache.match(networkUrl)) ?? null
  } catch {
    return null
  }
}

/**
 * Download, compress to WebP and store the wallpaper for the given network URL,
 * then hold the compressed copy ready so applying it paints that instead of the
 * network original. Does not touch the live display blob URL (owned by
 * resolveWallpaperDisplayUrl) so the background is never blanked mid-apply.
 */
export function persistWallpaperImage(networkUrl: string): Promise<string | null> {
  const url = networkUrl.trim()
  if (!url.startsWith('https://')) return Promise.resolve(null)

  let pending = persisting.get(url)
  if (!pending) {
    pending = persistCompressedWallpaper(url).finally(() => persisting.delete(url))
    persisting.set(url, pending)
  }
  return pending
}

async function persistCompressedWallpaper(url: string): Promise<string | null> {
  const existing = await matchWallpaper(url)
  if (existing) {
    try {
      const blob = await existing.blob()
      if (blob.size > 0) {
        // Caches written before compression hold the raw JPEG; convert those once.
        const stored = blob.type === 'image/webp' ? blob : await compressWallpaperBlob(blob)
        if (stored !== blob) await putWallpaperBlob(url, stored)
        else writeMeta(url)
        prepareDisplayBlob(url, stored)
        return url
      }
    } catch {
      /* fall through to re-fetch */
    }
  }

  try {
    const res = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'force-cache',
      headers: { accept: 'image/webp,image/*' },
    })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || ''
    if (contentType && !contentType.startsWith('image/')) {
      // Still allow if Pexels omits type; only reject obvious non-images.
      if (contentType.includes('json') || contentType.includes('text/html')) return null
    }
    const compressed = await compressWallpaperBlob(await res.blob())
    await putWallpaperBlob(url, compressed)
    prepareDisplayBlob(url, compressed)
    return url
  } catch {
    return null
  }
}

/**
 * Hands over the compressed copy persist made ready for this wallpaper, if any,
 * so the apply can paint it synchronously instead of the heavy network URL.
 */
export function takePreparedWallpaperUrl(networkUrl: string): string | null {
  if (!prepared || !sameWallpaperUrl(prepared.networkUrl, networkUrl)) return null
  const { objectUrl } = prepared
  prepared = null
  setActiveObjectUrl(networkUrl, objectUrl)
  return objectUrl
}

async function blobUrlFromCache(cacheKey: string): Promise<string | null> {
  const cached = await matchWallpaper(cacheKey)
  if (!cached) return null
  try {
    const blob = await cached.blob()
    if (!blob.size) return null
    setActiveObjectUrl(cacheKey, URL.createObjectURL(blob))
    // Cached before wallpapers were compressed: convert it for the next launch.
    if (blob.type !== 'image/webp') void persistWallpaperImage(cacheKey)
    return activeObjectUrl
  } catch {
    return null
  }
}

function sameWallpaperUrl(a: string, b: string): boolean {
  if (a === b) return true
  const idA = a.match(/\/photos\/(\d+)\//)?.[1]
  const idB = b.match(/\/photos\/(\d+)\//)?.[1]
  return Boolean(idA && idA === idB)
}

/**
 * Resolve a display URL for the wallpaper: prefer cached blob, else network URL.
 * Also warms the cache in the background when serving from network.
 * When offline, never fall back to a live network URL (that would error and blank the UI).
 */
export async function resolveWallpaperDisplayUrl(networkUrl: string | null | undefined): Promise<{
  displayUrl: string | null
  fromCache: boolean
}> {
  const url = networkUrl?.trim() || null
  if (!url) {
    revokeActiveObjectUrl()
    return { displayUrl: null, fromCache: false }
  }

  // Already painting this wallpaper's compressed copy; a new blob URL would re-decode it.
  if (activeObjectUrl && activeNetworkUrl && sameWallpaperUrl(activeNetworkUrl, url)) {
    return { displayUrl: activeObjectUrl, fromCache: true }
  }

  const exact = await blobUrlFromCache(url)
  if (exact) return { displayUrl: exact, fromCache: true }

  // Cache may be keyed under a prior Pexels query-string variant of the same photo.
  const meta = readMeta()
  if (meta?.networkUrl && meta.networkUrl !== url && sameWallpaperUrl(meta.networkUrl, url)) {
    const fromMeta = await blobUrlFromCache(meta.networkUrl)
    if (fromMeta) return { displayUrl: fromMeta, fromCache: true }
  }

  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  if (offline) {
    return { displayUrl: null, fromCache: false }
  }

  // Paint immediately from network; persist in background for next launch.
  void persistWallpaperImage(url)
  return { displayUrl: url, fromCache: false }
}

export async function clearPersistedWallpaper(networkUrl?: string | null) {
  revokeActiveObjectUrl()
  if (prepared) {
    URL.revokeObjectURL(prepared.objectUrl)
    prepared = null
  }
  const cache = await openCache()
  const meta = readMeta()
  const target = networkUrl?.trim() || meta?.networkUrl
  if (cache && target) {
    try {
      await cache.delete(target)
    } catch {
      /* ignore */
    }
  }
  clearMeta()
}
