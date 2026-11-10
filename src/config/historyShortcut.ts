const IS_MAC = typeof navigator !== 'undefined' && navigator.platform.includes('Mac')

/**
 * Back/forward through visited pages: Cmd+[ and Cmd+] on a Mac, Alt+Left and Alt+Right elsewhere.
 * Browsers already own these keys; the desktop app wires them in.
 */
const KEYS = {
  back: IS_MAC ? ['⌘', '['] : ['Alt', '←'],
  forward: IS_MAC ? ['⌘', ']'] : ['Alt', '→'],
} as const

/** "⌘[" or "Alt+←", for tooltips. */
export function historyShortcutText(direction: 'back' | 'forward'): string {
  return KEYS[direction].join(IS_MAC ? '' : '+')
}
