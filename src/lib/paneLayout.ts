import {
  type PersistedSidebarWidthOptions,
} from '@/composables/usePersistedSidebarWidth'

/**
 * Resizable side panes whose width (and open state) the app remembers.
 *
 * One definition per pane, shared by the page that owns it and by that page's
 * loading skeleton, so the skeleton draws the pane where the person left it
 * instead of at a default the real page then jumps away from.
 */
type PaneSpec = PersistedSidebarWidthOptions & {
  storageKey: string
  defaultWidth: number
  minWidth: number
  maxWidth: number
}
/** The Settings menu, beside the page it opens. */
export const SETTINGS_MENU_PANE = {
  storageKey: 'veenna.settings.menuWidth',
  defaultWidth: 240,
  minWidth: 180,
  maxWidth: 360,
} as const satisfies PaneSpec
