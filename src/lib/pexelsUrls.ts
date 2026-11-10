/** Full-bleed wallpaper base size; paired with dpr=2 for retina sharpness. */
const PEXELS_WALLPAPER_WIDTH = 1920
const PEXELS_WALLPAPER_HEIGHT = 1080
const PEXELS_DISPLAY_DPR = 2
const PEXELS_PHOTO_ID_RE = /\/photos\/(\d+)\//

export function extractPexelsPhotoId(url: string): number | null {
  const match = url.match(PEXELS_PHOTO_ID_RE)
  if (!match) return null
  const id = Number(match[1])
  return Number.isFinite(id) ? id : null
}



/**
 * Upgrade query params on a real Pexels CDN URL.
 * Preserves the path - rewriting to `pexels-photo-{id}.jpeg` breaks some photos.
 */
export function upgradePexelsUrl(url: string | null | undefined): string {
  const trimmed = url?.trim() ?? ''
  if (!trimmed.startsWith('https://images.pexels.com')) return trimmed

  try {
    const parsed = new URL(trimmed)
    if (parsed.searchParams.get('cs') === 'tinysrgb') {
      parsed.searchParams.set('cs', 'srgb')
    }
    const w = Number(parsed.searchParams.get('w') || 0)
    if (!parsed.searchParams.has('w') || (w > 0 && w < PEXELS_WALLPAPER_WIDTH)) {
      parsed.searchParams.set('w', String(PEXELS_WALLPAPER_WIDTH))
      parsed.searchParams.set('h', String(PEXELS_WALLPAPER_HEIGHT))
      if (!parsed.searchParams.has('fit')) parsed.searchParams.set('fit', 'crop')
    }
    if (!parsed.searchParams.has('dpr')) {
      parsed.searchParams.set('dpr', String(PEXELS_DISPLAY_DPR))
    }
    if (!parsed.searchParams.has('auto')) {
      parsed.searchParams.set('auto', 'compress')
    }
    return parsed.toString()
  } catch {
    return trimmed
  }
}
