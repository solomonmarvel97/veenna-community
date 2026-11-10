/** The text a stored record is searched by: a dictation's text, a task's title, a list's name. */
export function searchTextForVoiceCapture(item: {
  text?: string | null
  title?: string | null
  name?: string | null
}): string {
  return String(item.text || item.title || item.name || '').trim()
}
