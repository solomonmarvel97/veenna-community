const VOICE_HUD_APPEARANCE_STORAGE_KEY = 'veenna-hud-appearance'

export type HudSurfaceStyle = 'obsidian' | 'glass' | 'frost'

/** The HUD's icons are fixed (a mic when idle, a spinner while working); only the surface is chosen. */
export type HudAppearanceConfig = {
  surface: HudSurfaceStyle
  reduceMotion: boolean
}

export const DEFAULT_HUD_APPEARANCE: HudAppearanceConfig = {
  surface: 'obsidian',
  reduceMotion: true,
}

export const HUD_SURFACE_OPTIONS: Array<{
  id: HudSurfaceStyle
  label: string
  description: string
}> = [
  { id: 'obsidian', label: 'Obsidian', description: 'Deep matte black' },
  { id: 'glass', label: 'Glass', description: 'Smoked translucent' },
  { id: 'frost', label: 'Frost', description: 'Light frosted glass' },
]

function isSurfaceStyle(value: unknown): value is HudSurfaceStyle {
  return HUD_SURFACE_OPTIONS.some((option) => option.id === value)
}

export function normalizeHudAppearance(
  raw: Partial<HudAppearanceConfig> | null | undefined,
): HudAppearanceConfig {
  return {
    surface: isSurfaceStyle(raw?.surface) ? raw.surface : DEFAULT_HUD_APPEARANCE.surface,
    reduceMotion: Boolean(raw?.reduceMotion),
  }
}

export function readHudAppearance(): HudAppearanceConfig {
  try {
    const raw = localStorage.getItem(VOICE_HUD_APPEARANCE_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_HUD_APPEARANCE }
    return normalizeHudAppearance(JSON.parse(raw) as Partial<HudAppearanceConfig>)
  } catch {
    return { ...DEFAULT_HUD_APPEARANCE }
  }
}

export function writeHudAppearance(config: HudAppearanceConfig) {
  try {
    localStorage.setItem(
      VOICE_HUD_APPEARANCE_STORAGE_KEY,
      JSON.stringify(normalizeHudAppearance(config)),
    )
  } catch {
    /* ignore quota */
  }
}

export function isHudAppearanceSyncEvent(event: StorageEvent): boolean {
  return event.key === VOICE_HUD_APPEARANCE_STORAGE_KEY
}
