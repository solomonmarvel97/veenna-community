/** Canonical app paths. Use these instead of string literals. */
export const ROUTES = {
  home: '/',
  dictation: '/dictation',
  todos: '/todos',
  insights: '/insights',
  settings: '/settings',
  /** The floating dictation HUD window. */
  dictationHud: '/dictation-hud',
  /** Old name for Settings; redirects there. */
  preferences: '/preferences',
} as const

/** Standard query parameter keys. */
export const QUERY = {
  /** Settings tab. */
  tab: 'tab',
  /** A capture to open on the Dictation page. */
  capture: 'capture',
  /** A capture to highlight on the Dictation page. */
  highlight: 'highlight',
} as const

const SETTINGS_TABS = [
  'general',
  'system',
  'permissions',
  'appearance',
  'dictation',
  'models',
] as const
export type SettingsTab = (typeof SETTINGS_TABS)[number]

/** A settings tab named in an address, or null when it is not one (including old names). */
export function normalizeSettingsTab(tab: string): SettingsTab | null {
  // The speech-models page is the models page.
  if (tab === 'speech-models') return 'models'
  return (SETTINGS_TABS as readonly string[]).includes(tab) ? (tab as SettingsTab) : null
}

export function isSettingsTab(value: string): value is SettingsTab {
  return normalizeSettingsTab(value) != null
}

/** `/home` is the home page; hash and trailing slashes are not part of a path. */
export function normalizePath(path: string): string {
  if (!path) return ROUTES.home
  const withoutHash = path.split('#')[0] ?? path
  let trimmed = withoutHash
  while (trimmed.length > 1 && trimmed.endsWith('/')) trimmed = trimmed.slice(0, -1)
  return trimmed === '/home' ? ROUTES.home : trimmed
}

/** Where a settings tab lives. General is the default and needs no query. */
export function settingsPath(tab?: SettingsTab): { path: string; query?: Record<string, string> } {
  return tab && tab !== 'general'
    ? { path: ROUTES.settings, query: { [QUERY.tab]: tab } }
    : { path: ROUTES.settings }
}
