import {
  clearAuthPageBackgroundUrl,
  readAuthPageBackgroundUrl,
} from '@/composables/useSharedPhotoBackground'
import { useThemeStore } from '@/stores/theme'

function preloadPhotoUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.referrerPolicy = 'no-referrer'
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Failed to load photo'))
    img.src = url
  })
}


export async function validateStoredPhotoBackgrounds() {
  const theme = useThemeStore()
  if (theme.backgroundUrl) {
    try {
      const { resolveWallpaperDisplayUrl } = await import('@/lib/wallpaperImageCache')
      const resolved = await resolveWallpaperDisplayUrl(theme.backgroundUrl)
      if (resolved.fromCache && resolved.displayUrl) return
      await preloadPhotoUrl(theme.backgroundUrl)
    } catch {
      /* Keep the synced URL. A fetch/CSP miss must not wipe wallpaper on other devices. */
    }
  }

  const authUrl = readAuthPageBackgroundUrl()
  if (authUrl) {
    try {
      await preloadPhotoUrl(authUrl)
    } catch {
      clearAuthPageBackgroundUrl()
    }
  }
}
