const STT_PROMPT_MAX = 224
const VERBATIM_STYLE_KEYS = new Set(['verbatim', 'original'])

export type SttDictionaryEntry = {
  term: string
  replacement?: string | null
  pronunciationHint?: string | null
}

/**
 * Spellings we want Whisper to prefer for one dictionary entry.
 *
 * Must stay in lockstep with `buildSttPromptFromEntries` on the server:
 * only the corrected form belongs here. Feeding the misheard term ("Vienna")
 * or phrasing like "Vienna means Veenna" biases the decode toward the mistake
 * the dictionary exists to correct, and invents text that was never spoken.
 */
function canonicalSttForms(entry: SttDictionaryEntry): string[] {
  const replacement = String(entry.replacement || '').trim()
  const hint = String(entry.pronunciationHint || '').trim()
  const term = String(entry.term || '').trim()
  const primary = replacement || term
  if (!primary) return []
  const forms = [primary]
  if (hint && hint !== primary) forms.push(hint)
  return forms
}

/**
 * Vocabulary hints for Whisper's `prompt` field.
 *
 * Whisper conditions its decode on this text, so it must contain only words we expect to
 * *hear* - proper nouns, jargon, pronunciation hints. Writing-style instructions belong to
 * the format LLM: feeding them here biases the acoustic decode toward text that was never
 * spoken, which is a known source of Whisper hallucination on quiet or ambiguous audio.
 */
export function buildLocalSttPrompt(params: {
  dictionaryEntries: SttDictionaryEntry[]
  /** @deprecated Ignored - style never reaches the transcription model. */
  stylePrompt?: string | null
}): string | undefined {
  const seen = new Set<string>()
  const hints: string[] = []
  for (const entry of params.dictionaryEntries) {
    for (const form of canonicalSttForms(entry)) {
      const key = form.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      hints.push(form)
    }
  }
  if (!hints.length) return undefined

  // Cut on an entry boundary so the prompt never ends mid-word.
  let out = ''
  for (const hint of hints) {
    const next = out ? `${out}, ${hint}` : hint
    if (next.length > STT_PROMPT_MAX) break
    out = next
  }
  return out || undefined
}

export function resolveSttLanguage(settingsLanguage?: string | null): string {
  if (settingsLanguage?.trim()) return settingsLanguage.trim().slice(0, 16)
  if (typeof navigator !== 'undefined') {
    const locale = navigator.language || 'en'
    const base = locale.split('-')[0]?.toLowerCase()
    if (base) return base
  }
  return 'en'
}


/** True when the active style keeps the speaker's original wording (default path). */
export function isVerbatimStylePrompt(prompt: string | null | undefined): boolean {
  const key = String(prompt || '')
    .trim()
    .toLowerCase()
  return !key || VERBATIM_STYLE_KEYS.has(key)
}

/** True when a writing style or transform should run the full rewrite endpoint. */
export function shouldApplyStyleRewrite(params: {
  stylePrompt: string | null | undefined
  transformId: string | null
}): boolean {
  if (params.transformId) return true
  return !isVerbatimStylePrompt(params.stylePrompt)
}

/** Short clips use buffered JSON; longer dictation streams into the HUD. */
export const SHORT_FORMAT_CLIP_CHARS = 280

export function isShortFormatClip(text: string, maxChars = SHORT_FORMAT_CLIP_CHARS): boolean {
  return String(text || '').trim().length <= maxChars
}
