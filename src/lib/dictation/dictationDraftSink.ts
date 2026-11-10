export type DictationDraftSink = {
  isTarget: (el: Element | null) => boolean
  getBaseText: () => string
  insert: (text: string) => boolean
}

const sinks = new Set<DictationDraftSink>()
let lastSink: DictationDraftSink | null = null

export function registerDictationDraftSink(sink: DictationDraftSink) {
  sinks.add(sink)
  return () => {
    sinks.delete(sink)
    if (lastSink === sink) lastSink = null
  }
}

export function markDictationDraftSinkActive(sink: DictationDraftSink) {
  lastSink = sink
}

/**
 * Insert into a Vue-backed field only when that field is the insert target.
 * Never fall back to a previously focused composer - delivery follows focus.
 */
export function insertIntoActiveDictationDraft(text: string, el?: Element | null): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false

  const active = el ?? (document.activeElement instanceof Element ? document.activeElement : null)
  const sink = [...sinks].find((candidate) => candidate.isTarget(active))
  if (!sink) return false
  return sink.insert(trimmed)
}
