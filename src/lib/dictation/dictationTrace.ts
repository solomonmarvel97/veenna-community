/**
 * Developer mode: a trace for one dictation, from the key release to the
 * paste, so a slow stop can be read step by step.
 *
 * The HUD window runs the dictation but the history list lives in the main
 * window, and each window has its own in-memory collector. A finished trace
 * is therefore also kept in localStorage (shared by both windows), keyed by
 * the capture it produced, and handed back to the main window's collector
 * when someone opens it. Server spans for the same trace id are fetched by
 * the viewer as usual.
 *
 * Every entry point is a no-op while developer mode is off.
 */

import { ref } from 'vue'
import { collector, currentSpanId, newSpanId, startAction } from '@/lib/trace'
import type { TraceRun, TraceSpan } from '@/lib/trace'

const STORAGE_KEY = 'veenna-dictation-traces'

/** A debug buffer, not a history: oldest traces fall off. */
const MAX_SAVED = 40

type SavedDictationTrace = {
  captureId: string
  run: TraceRun
  spans: TraceSpan[]
  savedAt: number
}

export type DictationTrace = {
  readonly traceId: string
  /** Close the step that just finished; its span covers the time since the previous step. */
  step(name: string, detail?: string): void
  /** Tie this trace to the history row it produced. The latest id wins. */
  linkCapture(captureId: string | null | undefined): void
  /** End the trace. Safe to call more than once; only the first call counts. */
  finish(outcome?: { ok?: boolean; error?: unknown }): void
}

function perfNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

/** Timer details are colored for the terminal; the viewer wants the words only. */
function withoutAnsiColors(text: string): string {
  let out = ''
  let inEscape = false
  for (const char of text) {
    if (inEscape) {
      if (char === 'm') inEscape = false
      continue
    }
    if (char === '\u001b') {
      inEscape = true
      continue
    }
    out += char
  }
  return out
}

function readSaved(): SavedDictationTrace[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as SavedDictationTrace[]) : []
  } catch {
    return []
  }
}

function writeSaved(entries: SavedDictationTrace[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    /* storage full or refused: the trace simply is not kept */
  }
}

/** captureId → traceId, reactive so the history menu item appears as traces land. */
const tracedCaptures = ref<Record<string, string>>(captureIndex(readSaved()))

function captureIndex(entries: SavedDictationTrace[]): Record<string, string> {
  const index: Record<string, string> = {}
  for (const entry of entries) index[entry.captureId] = entry.run.trace_id
  return index
}

function persist(captureId: string, traceId: string): void {
  const collected = collector.get(traceId)
  if (!collected) return
  const { spans, index: _index, ...run } = collected
  const entries = readSaved().filter((entry) => entry.captureId !== captureId)
  entries.push({ captureId, run, spans: [...spans], savedAt: Date.now() })
  const kept = entries.slice(-MAX_SAVED)
  writeSaved(kept)
  tracedCaptures.value = captureIndex(kept)
}

/** Deferred so saving a trace never sits between the dictation and its paste. */
function persistLater(captureId: string, traceId: string): void {
  setTimeout(() => persist(captureId, traceId), 0)
}

const NOOP_TRACE: DictationTrace = {
  traceId: '',
  step() {},
  linkCapture() {},
  finish() {},
}

/**
 * Start tracing a dictation. Anything the HUD sends to the API while this is
 * open carries the trace id, so the server's spans join the same tree.
 */
export function beginDictationTrace(
  name: string,
  attrs: Record<string, string | number | boolean> = {},
): DictationTrace {
  const action = startAction(`dictation.${name}`, { attrs })
  if (!action) return NOOP_TRACE

  const { traceId } = action
  const rootId = currentSpanId()
  const startedPerf = perfNow()
  const startedWall = Date.now()
  let lastPerf = startedPerf
  let captureId: string | null = null
  let finished = false

  return {
    traceId,
    step(stepName, detail) {
      if (finished) return
      const at = perfNow()
      const attrs: Record<string, string | number> = { total_ms: Math.round(at - startedPerf) }
      if (detail) attrs.detail = withoutAnsiColors(detail).slice(0, 300)
      collector.addSpan({
        trace_id: traceId,
        span_id: newSpanId(),
        parent_id: rootId,
        name: `dictation.${stepName}`,
        kind: 'internal',
        tier: 'browser',
        started_at: startedWall + Math.round(lastPerf - startedPerf),
        ms: Math.round(at - lastPerf),
        ok: true,
        attrs,
      })
      lastPerf = at
    },
    linkCapture(id) {
      if (id) captureId = id
    },
    finish(outcome = {}) {
      if (finished) return
      finished = true
      action.end(outcome)
      if (captureId) persistLater(captureId, traceId)
    },
  }
}

/** The trace recorded for a history row, when developer mode captured one. */
export function dictationTraceIdFor(captureId: string | null | undefined): string | null {
  if (!captureId) return null
  return tracedCaptures.value[captureId] ?? null
}

/**
 * Put a saved trace into this window's collector so the viewer can draw it.
 * Returns the trace id, or null when this capture was never traced.
 */
export function loadDictationTrace(captureId: string): string | null {
  const entry = readSaved().find((saved) => saved.captureId === captureId)
  if (!entry) return null
  const traceId = entry.run.trace_id
  if (!collector.has(traceId)) {
    collector.openTrace(entry.run)
    collector.addSpans(entry.spans)
    collector.closeTrace(traceId, {
      status: entry.run.status,
      ended_at: entry.run.ended_at,
      total_ms: entry.run.total_ms,
      error_message: entry.run.error_message,
    })
  }
  return traceId
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) tracedCaptures.value = captureIndex(readSaved())
  })
}

export { STORAGE_KEY as DICTATION_TRACES_STORAGE_KEY }
