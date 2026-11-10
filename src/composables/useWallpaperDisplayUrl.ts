import { computed, ref, watch } from 'vue'
import { extractPexelsPhotoId, upgradePexelsUrl } from '@/lib/pexelsUrls'
import { resolveWallpaperDisplayUrl, takePreparedWallpaperUrl } from '@/lib/wallpaperImageCache'
import { useThemeStore } from '@/stores/theme'

/** Shared across AppBackground + home greeting so both paint the same cached frame. */
const displayUrl = ref<string | null>(null)
let resolveSeq = 0
let watchStarted = false

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function startWatch() {
  if (watchStarted) return
  watchStarted = true
  const theme = useThemeStore()

  watch(
    () => upgradePexelsUrl(theme.backgroundUrl),
    (url) => {
      const seq = ++resolveSeq
      if (!url) {
        displayUrl.value = null
        return
      }

      // Apply immediately while Settings (or another modal) is still open.
      // Keeping the previous frame until async cache resolve finishes made
      // wallpaper / blur changes appear stuck until the modal closed.
      // flush:'sync' so the new URL paints in the same turn as setBackgroundUrl.
      // Prefer the compressed WebP the apply flow prepared over the heavy original.
      const prepared = takePreparedWallpaperUrl(url)
      if (prepared) {
        displayUrl.value = prepared
      } else if (!isOffline()) {
        displayUrl.value = url
      }

      void resolveWallpaperDisplayUrl(url).then((result) => {
        if (seq !== resolveSeq) return
        if (result.displayUrl) {
          displayUrl.value = result.displayUrl
          return
        }
        if (!displayUrl.value && !isOffline()) {
          displayUrl.value = url
        }
      })
    },
    { immediate: true, flush: 'sync' },
  )
}

/**
 * Offline-safe wallpaper display URL (prefers Cache Storage blob).
 * Shared so the full-app background and home hero stay in sync.
 */
export function useWallpaperDisplayUrl() {
  startWatch()
  const theme = useThemeStore()
  const networkUrl = computed(() => upgradePexelsUrl(theme.backgroundUrl))

  async function recoverFromLoadError() {
    const url = networkUrl.value
    if (!url) {
      displayUrl.value = null
      return false
    }
    const result = await resolveWallpaperDisplayUrl(url)
    if (result.displayUrl) {
      displayUrl.value = result.displayUrl
      return true
    }
    if (!isOffline()) {
      displayUrl.value = url
      return true
    }
    // Offline with nothing cached: keep whatever is already on screen.
    return Boolean(displayUrl.value)
  }

  return {
    networkUrl,
    displayUrl: computed(() => displayUrl.value),
    photoId: computed(() => extractPexelsPhotoId(networkUrl.value || '')),
    recoverFromLoadError,
  }
}

/** @internal test helper - clears module singletons between vitest cases. */
export function __resetWallpaperDisplayUrlForTests() {
  displayUrl.value = null
  resolveSeq = 0
  watchStarted = false
}
