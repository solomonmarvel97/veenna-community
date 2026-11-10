import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { upgradePexelsUrl } from '@/lib/pexelsUrls'
import type { ThemeMode } from '@/lib/activeView'
import { applyAppearance, clampWallpaperBlur, clampWallpaperFocus, clampWallpaperZoom, defaultAppearance, normalizeHex, WALLPAPER_BLUR_DEFAULT, WALLPAPER_ZOOM_MIN, type WallpaperFraming, type VeennaAppearance } from '@/lib/veennaAppearance'
import { writeMotionEnabled } from '@/lib/motionPreferences'
import { applyMotionDomFlags } from '@/motion/reducedMotion'
import { clearPersistedWallpaper, persistWallpaperImage } from '@/lib/wallpaperImageCache'

export type { ThemeMode } from '@/lib/activeView'

const STORAGE_KEY = 'veenna-theme'
const BACKGROUND_KEY = 'veenna-background'
const APPEARANCE_KEY = 'veenna-appearance'
const APPEARANCE_UPDATED_AT_KEY = 'veenna-appearance-updated-at'

const LEGACY_STORAGE_KEYS: Record<string, string> = {
  [STORAGE_KEY]: 'veenna-app-theme',
  [BACKGROUND_KEY]: 'veenna-app-background',
  [APPEARANCE_KEY]: 'veenna-app-appearance',
}

function migrateStorageKey(key: string) {
  if (typeof localStorage === 'undefined') return
  if (localStorage.getItem(key) != null) return
  const legacy = LEGACY_STORAGE_KEYS[key]
  if (!legacy) return
  const value = localStorage.getItem(legacy)
  if (value != null) localStorage.setItem(key, value)
}

migrateStorageKey(STORAGE_KEY)
migrateStorageKey(BACKGROUND_KEY)
migrateStorageKey(APPEARANCE_KEY)

function normalizeBackgroundUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim() || null
  if (!trimmed) return null
  if (trimmed.startsWith('https://images.pexels.com')) {
    return upgradePexelsUrl(trimmed)
  }
  if (trimmed.startsWith('https://')) {
    return trimmed
  }
  return null
}

function readStoredBackground(): string | null {
  return normalizeBackgroundUrl(localStorage.getItem(BACKGROUND_KEY))
}

function readStoredAppearanceUpdatedAt(): number {
  const n = Number(localStorage.getItem(APPEARANCE_UPDATED_AT_KEY))
  return Number.isFinite(n) && n > 0 ? n : 0
}

function readStoredMode(): ThemeMode {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  return 'system'
}

function normalizeAppearance(
  parsed: Partial<VeennaAppearance> | null | undefined,
): VeennaAppearance {
  const base = defaultAppearance()
  if (!parsed) return base
  return {
    accentLight: normalizeHex(parsed.accentLight ?? undefined),
    accentDark: normalizeHex(parsed.accentDark ?? undefined),
    motionEnabled:
      typeof parsed.motionEnabled === 'boolean' ? parsed.motionEnabled : base.motionEnabled,
    wallpaperBlur:
      parsed.wallpaperBlur === undefined || parsed.wallpaperBlur === null
        ? WALLPAPER_BLUR_DEFAULT
        : clampWallpaperBlur(parsed.wallpaperBlur),
    wallpaperFocusX: clampWallpaperFocus(parsed.wallpaperFocusX ?? 50),
    wallpaperFocusY: clampWallpaperFocus(parsed.wallpaperFocusY ?? 50),
    wallpaperZoom: clampWallpaperZoom(parsed.wallpaperZoom ?? WALLPAPER_ZOOM_MIN),
  }
}

function readStoredAppearance(): VeennaAppearance {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY)
    if (!raw) return defaultAppearance()
    return normalizeAppearance(JSON.parse(raw) as VeennaAppearance)
  } catch {
    return defaultAppearance()
  }
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

function applyThemeToDocument(resolved: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', resolved)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

export function initThemeBeforeMount() {
  const mode = readStoredMode()
  const resolved = resolveTheme(mode)
  applyThemeToDocument(resolved)
  applyAppearance(readStoredAppearance(), resolved)
}

/** Dictation HUD is a transparent Electron overlay - never inherit app chrome backgrounds. */
export function initHudSurfaceBeforeMount() {
  if (typeof document === 'undefined') return
  if (!window.veennaElectron?.isDictationHud) return
  document.documentElement.dataset.veennaSurface = 'dictation-hud'
  document.documentElement.classList.add('dictation-hud-root')
  document.body?.classList.add('dictation-hud-root')
}

/** Apply motion CSS flag before first paint (Animations on by default). */
export function initMotionBeforeMount() {
  applyMotionDomFlags()
}


export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(readStoredMode())
  const backgroundUrl = ref<string | null>(readStoredBackground())
  const appearance = ref<VeennaAppearance>(readStoredAppearance())
  const motionEnabled = computed(() => Boolean(appearance.value.motionEnabled))
  const backgroundPickerOpen = ref(false)
  /** Bumps on user-initiated wallpaper apply so the UI can play a settle animation. */
  const wallpaperApplyGeneration = ref(0)
  const appearanceUpdatedAt = ref(readStoredAppearanceUpdatedAt())
  let mediaQuery: MediaQueryList | null = null

  const resolved = computed(() => resolveTheme(mode.value))
  const isDark = computed(() => resolved.value === 'dark')
  const hasBackground = computed(() => Boolean(backgroundUrl.value?.trim()))
  const hasCustomAccent = computed(() =>
    Boolean(appearance.value.accentLight || appearance.value.accentDark),
  )
  const hasCustomTheme = computed(
    () => mode.value !== 'system' || hasCustomAccent.value || hasBackground.value,
  )

  /** Appearance lives on this device only: there is no account to sync it to. */
  function writeLocalCache() {
    localStorage.setItem(STORAGE_KEY, mode.value)
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance.value))
    writeMotionEnabled(Boolean(appearance.value.motionEnabled))
    if (backgroundUrl.value) localStorage.setItem(BACKGROUND_KEY, backgroundUrl.value)
    else localStorage.removeItem(BACKGROUND_KEY)
    if (appearanceUpdatedAt.value > 0) {
      localStorage.setItem(APPEARANCE_UPDATED_AT_KEY, String(appearanceUpdatedAt.value))
    } else {
      localStorage.removeItem(APPEARANCE_UPDATED_AT_KEY)
    }
  }

  function applyThemeAndAppearance() {
    applyThemeToDocument(resolved.value)
    applyAppearance(appearance.value, resolved.value)
    applyMotionDomFlags()
    writeLocalCache()
  }

  function touchAppearanceUpdatedAt() {
    appearanceUpdatedAt.value = Date.now()
  }

  function apply() {
    applyThemeAndAppearance()
  }

  function setMode(next: ThemeMode) {
    mode.value = next
    touchAppearanceUpdatedAt()
    apply()
  }

  function toggle() {
    setMode(isDark.value ? 'light' : 'dark')
  }

  function cycleMode() {
    const order: ThemeMode[] = ['system', 'light', 'dark']
    const idx = order.indexOf(mode.value)
    setMode(order[(idx + 1) % order.length])
  }

  function setMotionEnabled(enabled: boolean) {
    appearance.value = { ...appearance.value, motionEnabled: enabled }
    touchAppearanceUpdatedAt()
    applyMotionDomFlags()
    writeLocalCache()
  }

  function setAccentLight(color: string | null) {
    appearance.value = { ...appearance.value, accentLight: normalizeHex(color) }
    touchAppearanceUpdatedAt()
    applyThemeAndAppearance()
  }

  function setAccentDark(color: string | null) {
    appearance.value = { ...appearance.value, accentDark: normalizeHex(color) }
    touchAppearanceUpdatedAt()
    applyThemeAndAppearance()
  }

  /** The wallpaper's crop: the point kept in view and the zoom, saved with appearance. */
  function setWallpaperFraming(framing: WallpaperFraming) {
    appearance.value = {
      ...appearance.value,
      wallpaperFocusX: clampWallpaperFocus(framing.x),
      wallpaperFocusY: clampWallpaperFocus(framing.y),
      wallpaperZoom: clampWallpaperZoom(framing.zoom),
    }
    touchAppearanceUpdatedAt()
    writeLocalCache()
  }

  function setWallpaperBlur(px: number) {
    appearance.value = { ...appearance.value, wallpaperBlur: clampWallpaperBlur(px) }
    touchAppearanceUpdatedAt()
    applyThemeAndAppearance()
  }

  function resetAccents() {
    appearance.value = { ...appearance.value, accentLight: null, accentDark: null }
    touchAppearanceUpdatedAt()
    applyThemeAndAppearance()
  }

  function resetTheme() {
    mode.value = 'system'
    appearance.value = defaultAppearance()
    backgroundUrl.value = null
    touchAppearanceUpdatedAt()
    applyThemeAndAppearance()
  }

  function setBackgroundUrl(url: string | null, opts?: { persist?: boolean; animate?: boolean }) {
    const next = normalizeBackgroundUrl(url)
    const prev = backgroundUrl.value
    backgroundUrl.value = next
    if (opts?.persist !== false) touchAppearanceUpdatedAt()
    writeLocalCache()
    if (!next) {
      void clearPersistedWallpaper(prev)
    } else if (next !== prev) {
      void persistWallpaperImage(next)
    }
    if (opts?.animate !== false && backgroundUrl.value) {
      wallpaperApplyGeneration.value += 1
    }
  }

  function clearBackground() {
    setBackgroundUrl(null)
  }

  function openBackgroundPicker() {
    backgroundPickerOpen.value = true
  }

  function closeBackgroundPicker() {
    backgroundPickerOpen.value = false
  }

  let systemPreferenceBound = false

  function watchSystemPreference() {
    if (typeof window === 'undefined') return () => undefined
    if (systemPreferenceBound) return () => undefined
    systemPreferenceBound = true
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (mode.value === 'system') apply()
    }
    mediaQuery.addEventListener('change', handler)
    // App-lifetime listener: OS theme changes apply even when settings/nav are closed.
    return () => undefined
  }

  watch(resolved, () => {
    applyAppearance(appearance.value, resolved.value)
  })

  // Keep the native window chrome (macOS traffic lights) on the app's theme.
  watch(
    mode,
    (next) => {
      void window.veennaElectron?.setNativeTheme?.(next)?.catch(() => {})
    },
    { immediate: true },
  )

  applyThemeAndAppearance()
  watchSystemPreference()

  return {
    mode,
    resolved,
    isDark,
    hasBackground,
    hasCustomAccent,
    hasCustomTheme,
    backgroundUrl,
    appearance,
    motionEnabled,
    backgroundPickerOpen,
    wallpaperApplyGeneration,
    setMode,
    toggle,
    cycleMode,
    setMotionEnabled,
    setAccentLight,
    setAccentDark,
    setWallpaperBlur,
    setWallpaperFraming,
    resetAccents,
    resetTheme,
    setBackgroundUrl,
    clearBackground,
    openBackgroundPicker,
    closeBackgroundPicker,
    watchSystemPreference,
  }
})
