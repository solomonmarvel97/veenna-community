/** macOS: Option. Windows: Right Alt. Hold = PTT; press twice = hands-free. */

export type DictationPlatform = 'mac' | 'windows' | 'other'

export function detectDictationPlatform(): DictationPlatform {
  if (typeof window !== 'undefined' && window.veennaElectron?.platform === 'darwin') return 'mac'
  if (typeof window !== 'undefined' && window.veennaElectron?.platform === 'win32') return 'windows'

  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent
  if (/Mac|iPhone|iPad|iPod/.test(ua)) return 'mac'
  if (/Win/.test(navigator.platform) || /Windows/.test(ua)) return 'windows'
  return 'other'
}

export function dictationKeyLabel(platform = detectDictationPlatform()): string {
  return platform === 'mac' ? 'Option' : 'Right Alt'
}

/** Left or right Option (Mac) / Right Alt (Windows). */
function isDictationTriggerKey(event: KeyboardEvent): boolean {
  const platform = detectDictationPlatform()
  if (platform === 'mac') {
    if (event.code === 'AltLeft' || event.code === 'AltRight') return true
    return event.key === 'Alt' && (event.location === 1 || event.location === 2)
  }
  return event.code === 'AltRight' || (event.key === 'Alt' && event.location === 2)
}

/** True when the dictation trigger key itself is pressed. */
export function isDictationShortcutDown(
  event: KeyboardEvent,
  platform = detectDictationPlatform(),
): boolean {
  return isDictationTriggerKey(event)
}

/** Globe / Fn - stop hands-free sessions (macOS). */
export function isHandsFreeStopKey(event: KeyboardEvent): boolean {
  if (event.repeat) return false
  return event.code === 'Fn' || event.code === 'Globe' || event.key === 'Fn'
}

export function syntheticDictationKeyEvent(
  type: 'down' | 'up',
  platform = detectDictationPlatform(),
): KeyboardEvent {
  const code = platform === 'mac' ? 'AltRight' : 'AltRight'
  return new KeyboardEvent(type === 'down' ? 'keydown' : 'keyup', {
    key: 'Alt',
    code,
    location: 2,
    bubbles: true,
    altKey: type === 'down',
  })
}
