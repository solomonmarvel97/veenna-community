import { PhDesktop, PhGear, PhMicrophone, PhPalette, PhShieldCheck, PhBrain } from '@phosphor-icons/vue'
import type { SettingsTab } from '@/router/paths'
import type { NavIconTileColor } from '@/lib/navIconTile'

export type SettingsTabDef = {
  id: SettingsTab
  label: string
  description: string
  icon: typeof PhGear
  iconTile: NavIconTileColor
}

/** The Settings pages, in the order the menu lists them. */
const SETTINGS_TAB_DEFS: SettingsTabDef[] = [
  {
    id: 'general',
    label: 'General',
    description: 'Shortcuts, microphone, and language.',
    icon: PhGear,
    iconTile: 'gray',
  },
  {
    id: 'system',
    label: 'System',
    description: 'Desktop app, startup, and sound.',
    icon: PhDesktop,
    iconTile: 'blue',
  },
  {
    id: 'permissions',
    label: 'Permissions',
    description: 'What veenna is allowed to do on this Mac, and how to take it back.',
    icon: PhShieldCheck,
    iconTile: 'teal',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Theme, wallpaper, accent colors, and animations.',
    icon: PhPalette,
    iconTile: 'purple',
  },
  {
    id: 'dictation',
    label: 'Dictation',
    description: 'Voice routing, HUD, hotkeys, and formatting.',
    icon: PhMicrophone,
    iconTile: 'red',
  },
  {
    id: 'models',
    label: 'Models',
    description: 'On-device speech models: download more, or import your own.',
    icon: PhBrain,
    iconTile: 'purple',
  },
]

/** The desktop platform this window is running on, or '' in a browser. */
function currentDesktopPlatform(): string {
  if (typeof window === 'undefined') return ''
  return String(window.veennaElectron?.platform || '')
}

/**
 * Whether this OS gates anything veenna can show a permission row for. macOS gates the most
 * through TCC, and Windows gates the microphone through its privacy settings. Linux desktops
 * leave all of it to the session, so a Permissions page there could only say "nothing here".
 */
function platformManagesPermissions(platform: string): boolean {
  return platform === 'darwin' || platform === 'win32'
}

/** Permissions belongs to the desktop app; a browser handles its own. */
function isTabVisible(tab: SettingsTab, isElectronApp: boolean, platform: string): boolean {
  return tab !== 'permissions' || (isElectronApp && platformManagesPermissions(platform))
}

/** The tab to show for a requested one: itself, or General when it is not available here. */
export function resolveSettingsTab(
  tab: SettingsTab,
  isElectronApp = false,
  platform: string = currentDesktopPlatform(),
): SettingsTab {
  return isTabVisible(tab, isElectronApp, platform) ? tab : 'general'
}

/** The tabs to list in the menu on this platform. */
export function visibleSettingsTabs(
  isElectronApp = false,
  platform: string = currentDesktopPlatform(),
): SettingsTabDef[] {
  return SETTINGS_TAB_DEFS.filter((tab) => isTabVisible(tab.id, isElectronApp, platform))
}

export function settingsTabLabel(tab: SettingsTab): string {
  return SETTINGS_TAB_DEFS.find((def) => def.id === tab)?.label ?? 'Settings'
}
