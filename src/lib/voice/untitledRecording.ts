export function untitledRecordingText(durationMs?: number | null): string {
  const sec =
    durationMs != null && Number.isFinite(durationMs)
      ? Math.max(0, Math.round(durationMs / 1000))
      : 0
  if (sec >= 60) {
    const minutes = Math.floor(sec / 60)
    const seconds = String(sec % 60).padStart(2, '0')
    return `Recording · ${minutes}:${seconds}`
  }
  if (sec > 0) return `Recording · ${sec}s`
  return 'Recording'
}

/** Placeholder titles used when audio was kept but there is no transcript yet. */
export function isUntitledRecordingLabel(text: string): boolean {
  const value = text.trim()
  return value === 'Recording' || value.startsWith('Recording · ')
}

/** Accidental 1–2s HUD clips are not useful to play or transcribe. */
const MIN_LISTABLE_PLACEHOLDER_MS = 3_000

/**
 * Home / history should only list captures that can be played or that already
 * have a real transcript. Untitled rows without audio, or too-short placeholder
 * recordings, cannot be transcribed.
 */
export function isListableVoiceCapture(item: {
  hasAudio?: boolean
  durationMs?: number | null
  text?: string | null
}): boolean {
  const label = (item.text || '').trim()
  if (
    isUntitledRecordingLabel(label) &&
    item.durationMs != null &&
    item.durationMs < MIN_LISTABLE_PLACEHOLDER_MS
  ) {
    return false
  }
  if (item.hasAudio) return true
  if (!label) return false
  return !isUntitledRecordingLabel(label)
}
