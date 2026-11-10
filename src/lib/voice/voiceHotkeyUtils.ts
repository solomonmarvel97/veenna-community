import type { VoiceHotkey } from '@/types/electron'

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 'Tab', 'ContextMenu'])

const DISPLAY_KEY: Record<string, string> = {
  ' ': 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Escape: 'Esc',
  Delete: 'Del',
  Backspace: 'Backspace',
}

export function formatVoiceHotkey(hotkey: VoiceHotkey | null | undefined): string {
  if (!hotkey) return 'None'
  const parts: string[] = []
  if (hotkey.meta || hotkey.cmd || hotkey.command) parts.push('Command')
  if (hotkey.ctrl || hotkey.control) parts.push('Control')
  if (hotkey.alt || hotkey.option) parts.push('Option')
  if (hotkey.shift) parts.push('Shift')
  const key = String(hotkey.key || '').trim()
  if (key) parts.push(key.length === 1 ? key.toUpperCase() : key)
  return parts.join('+') || 'None'
}

export function hotkeyFromKeyboardEvent(event: KeyboardEvent): VoiceHotkey | null {
  if (MODIFIER_KEYS.has(event.key)) return null

  const hasModifier = event.metaKey || event.ctrlKey || event.altKey || event.shiftKey
  if (!hasModifier) return null

  const key = DISPLAY_KEY[event.key] ?? event.key
  if (!key || MODIFIER_KEYS.has(key)) return null

  return {
    meta: event.metaKey,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    key,
  }
}

export function validateVoiceHotkey(hotkey: VoiceHotkey | null): string | null {
  if (!hotkey) return null
  const label = formatVoiceHotkey(hotkey)
  if (label === 'None') return 'Choose a shortcut with at least one modifier and one key.'

  const key = String(hotkey.key || '').trim()
  if (hotkey.meta && key.toLowerCase() === 'space') {
    return 'Command+Space is reserved by Spotlight on macOS. Pick a different shortcut.'
  }
  if (hotkey.alt || hotkey.option) {
    return 'Option is reserved for dictation. Pick a different shortcut.'
  }
  if (key === 'Alt' || key === 'AltLeft' || key === 'AltRight' || key === 'Option') {
    return 'Option is reserved for dictation. Pick a different shortcut.'
  }
  return null
}
