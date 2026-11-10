/** Sidebar icon-tile colors (same palette as list accents). */
export const NAV_ICON_TILE_COLORS = {
  red: '#e74856',
  orange: '#ff8c00',
  yellow: '#ca5010',
  green: '#4caf6f',
  teal: '#00b7c3',
  blue: '#0078d4',
  purple: '#8764b8',
  gray: '#69797e',
} as const

export type NavIconTileColor = keyof typeof NAV_ICON_TILE_COLORS
