export const DEFAULT_ACCENT = {
  light: '#171717',
  dark: '#ffffff',
} as const

export const ACCENT_COLOR_PRESETS = [
  '#171717',
  '#157a3d',
  '#4caf6f',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#ca8a04',
  '#0891b2',
  '#64748b',
  '#78716c',
] as const

/** Wallpaper image blur in px (applied to the background layer, not pane backdrop-filter). */
export const WALLPAPER_BLUR_MIN = 0
export const WALLPAPER_BLUR_MAX = 40
export const WALLPAPER_BLUR_DEFAULT = 0

export type VeennaAppearance = {
  accentLight?: string | null
  accentDark?: string | null
  /** When true, Motion.dev scroll reveals and route transitions are enabled. Default off. */
  motionEnabled?: boolean
  /** Soften the wallpaper image behind translucent panes (0–40px). */
  wallpaperBlur?: number
  /** Wallpaper crop: the point kept in view, as % across and down (0–100, default centre). */
  wallpaperFocusX?: number
  wallpaperFocusY?: number
  /** Wallpaper crop: how far it is zoomed in (1 = fill the window, up to 3). */
  wallpaperZoom?: number
}

export const WALLPAPER_ZOOM_MIN = 1
export const WALLPAPER_ZOOM_MAX = 3

/** Where and how far in the wallpaper is framed. */
export type WallpaperFraming = { x: number; y: number; zoom: number }

export function clampWallpaperFocus(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 50
  return Math.min(100, Math.max(0, Math.round(n * 10) / 10))
}

export function clampWallpaperZoom(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return WALLPAPER_ZOOM_MIN
  return Math.min(WALLPAPER_ZOOM_MAX, Math.max(WALLPAPER_ZOOM_MIN, Math.round(n * 100) / 100))
}

export function wallpaperFramingOf(
  appearance: VeennaAppearance | null | undefined,
): WallpaperFraming {
  return {
    x: clampWallpaperFocus(appearance?.wallpaperFocusX ?? 50),
    y: clampWallpaperFocus(appearance?.wallpaperFocusY ?? 50),
    zoom: clampWallpaperZoom(appearance?.wallpaperZoom ?? WALLPAPER_ZOOM_MIN),
  }
}

/** Inline style for a cover <img>: keep the focus point in view, zoomed around it. */
export function wallpaperImageStyle(framing: WallpaperFraming): Record<string, string> {
  const at = `${framing.x}% ${framing.y}%`
  return {
    objectPosition: at,
    transformOrigin: at,
    transform: framing.zoom > 1 ? `scale(${framing.zoom})` : 'none',
  }
}

export function defaultAppearance(): VeennaAppearance {
  return {
    accentLight: null,
    accentDark: null,
    motionEnabled: true,
    wallpaperBlur: WALLPAPER_BLUR_DEFAULT,
    wallpaperFocusX: 50,
    wallpaperFocusY: 50,
    wallpaperZoom: WALLPAPER_ZOOM_MIN,
  }
}

export function clampWallpaperBlur(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return WALLPAPER_BLUR_DEFAULT
  return Math.min(WALLPAPER_BLUR_MAX, Math.max(WALLPAPER_BLUR_MIN, Math.round(n)))
}

export function normalizeHex(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const raw = value.trim()
  const hex = raw.startsWith('#') ? raw : `#${raw}`
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null
  return hex.toLowerCase()
}

export function accentForTheme(appearance: VeennaAppearance, resolved: 'light' | 'dark'): string {
  const custom = resolved === 'dark' ? appearance.accentDark : appearance.accentLight
  const normalized = normalizeHex(custom ?? undefined)
  return normalized ?? DEFAULT_ACCENT[resolved]
}

function accentForeground(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#0c0c0c' : '#ffffff'
}

function applyAccentVariables(accent: string) {
  const root = document.documentElement
  root.style.setProperty('--veenna-accent', accent)
  root.style.setProperty('--veenna-heatmap-accent', accent)
  root.style.setProperty('--veenna-accent-fg', accentForeground(accent))
  root.style.setProperty('--veenna-accent-soft', `color-mix(in srgb, ${accent} 14%, transparent)`)
}

function clearAccentOverrides() {
  const root = document.documentElement
  root.style.removeProperty('--veenna-accent')
  root.style.removeProperty('--veenna-heatmap-accent')
  root.style.removeProperty('--veenna-accent-fg')
  root.style.removeProperty('--veenna-accent-soft')
}

export function applyWallpaperBlurVariable(blurPx: number) {
  const root = document.documentElement
  const blur = clampWallpaperBlur(blurPx)
  root.style.setProperty('--veenna-wallpaper-blur', `${blur}px`)
  // Expand slightly so blur radius doesn't reveal empty edges under object-cover.
  root.style.setProperty(
    '--veenna-wallpaper-blur-scale',
    blur > 0 ? String(1 + Math.min(blur, WALLPAPER_BLUR_MAX) / 100) : '1',
  )
}

export function applyAppearance(appearance: VeennaAppearance, resolved: 'light' | 'dark') {
  const accent = accentForTheme(appearance, resolved)
  const usingDefault = !normalizeHex(
    resolved === 'dark' ? appearance.accentDark : appearance.accentLight,
  )

  if (usingDefault) clearAccentOverrides()
  else applyAccentVariables(accent)

  applyWallpaperBlurVariable(appearance.wallpaperBlur ?? WALLPAPER_BLUR_DEFAULT)
}
