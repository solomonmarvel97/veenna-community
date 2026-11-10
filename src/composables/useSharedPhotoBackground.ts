import { upgradePexelsUrl } from '@/lib/pexelsUrls'

const AUTH_BG_STORAGE_KEY = 'veenna-auth-page-background'

/** Current auth-page wallpaper URL, if one has been chosen. */
export function readAuthPageBackgroundUrl(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_BG_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { url?: string }
    const url = parsed.url?.trim()
    if (!url?.startsWith('https://images.pexels.com')) return null
    return upgradePexelsUrl(url)
  } catch {
    return null
  }
}

export function clearAuthPageBackgroundUrl() {
  try {
    localStorage.removeItem(AUTH_BG_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

