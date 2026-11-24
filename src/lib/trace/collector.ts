/**
 * Holds traces on the client and merges the three sources that feed them:
 * browser spans, Electron main spans, and server spans arriving over SSE.
 *
 * The client owns the merge because it is the only tier that sees all three.
 *
 * See docs/plans/tracing.md §9.
 */

import { reactive, computed } from 'vue'
import type { TraceNode, TraceRun, TraceSpan, TraceStatus } from './types'

/** Traces held in memory. Old ones are evicted; this is a debug buffer, not a store. */
const MAX_TRACES = 60

type CollectedTrace = TraceRun & {
  spans: TraceSpan[]
  /** span_id → index in `spans`, so an update is a lookup not a scan */
  index: Map<string, number>
}

const traces = reactive(new Map<string, CollectedTrace>())

/**
 * Traces this window never ran, opened only because their spans arrived (a
 * past trace loaded into the viewer). Their start, name and tier are
 * placeholders until the server's run replaces them: a copied trace once said
 * it started when the viewer opened, an hour after its spans ran.
 */
const openedFromSpans = new Set<string>()

function evict(): void {
  while (traces.size > MAX_TRACES) {
    const oldest = traces.keys().next()
    if (oldest.done) break
    traces.delete(oldest.value)
    openedFromSpans.delete(oldest.value)
  }
}

function openTrace(run: Partial<TraceRun> & { trace_id: string }): CollectedTrace {
  const existing = traces.get(run.trace_id)
  if (existing) return existing
  const entry: CollectedTrace = {
    trace_id: run.trace_id,
    root_name: run.root_name || 'action',
    entry_tier: run.entry_tier || 'browser',
    status: (run.status as TraceStatus) || 'running',
    started_at: run.started_at || Date.now(),
    ended_at: run.ended_at ?? null,
    total_ms: run.total_ms ?? null,
    span_count: 0,
    error_message: run.error_message ?? null,
    level: run.level || 'on',
    open: run.open ?? true,
    spans: [],
    index: new Map(),
  }
  traces.set(run.trace_id, entry)
  evict()
  return entry
}

/**
 * Add or update a span. Spans arrive twice - open then closed - and from more
 * than one tier, so this is upsert-by-span_id rather than append.
 */
function addSpan(span: TraceSpan): void {
  let entry = traces.get(span.trace_id)
  if (!entry) {
    entry = openTrace({ trace_id: span.trace_id })
    openedFromSpans.add(span.trace_id)
  }
  const at = entry.index.get(span.span_id)
  if (at === undefined) {
    entry.index.set(span.span_id, entry.spans.length)
    entry.spans.push(span)
  } else {
    entry.spans[at] = span
  }
  entry.span_count = entry.spans.length
}

function addSpans(spans: TraceSpan[]): void {
  for (const span of spans) addSpan(span)
}

function closeTrace(traceId: string, patch: Partial<TraceRun>): void {
  const entry = traces.get(traceId)
  if (!entry) return
  Object.assign(entry, patch, { open: false })
}

/**
 * Take what the server knows about a trace: its outcome once it finished, and
 * for a trace this window never ran, its real start, name and tier too. A trace
 * this window ran keeps its own start, the click that began it.
 */
function adoptServerRun(traceId: string, run: TraceRun): void {
  const entry = traces.get(traceId)
  if (!entry) return
  if (openedFromSpans.has(traceId)) {
    Object.assign(entry, {
      started_at: run.started_at,
      root_name: run.root_name,
      entry_tier: run.entry_tier,
      level: run.level,
    })
  }
  if (run.status && run.status !== 'running') {
    closeTrace(traceId, {
      status: run.status,
      ended_at: run.ended_at,
      total_ms: run.total_ms,
      error_message: run.error_message,
    })
  }
}

function get(traceId: string | null | undefined): CollectedTrace | null {
  if (!traceId) return null
  return traces.get(traceId) || null
}

function has(traceId: string | null | undefined): boolean {
  return Boolean(traceId && traces.has(traceId))
}

function list(): TraceRun[] {
  return [...traces.values()]
    .map(({ spans: _spans, index: _index, ...run }) => run)
    .sort((a, b) => b.started_at - a.started_at)
}

function clear(): void {
  traces.clear()
  openedFromSpans.clear()
}

/**
 * Arrange a flat span list into the tree the viewer draws.
 *
 * Two things this has to survive, both routine:
 *   - a child whose parent never arrived (dropped span, tier that never
 *     reported) - it is re-rooted rather than lost
 *   - a child that claims to have started before its parent, because a laptop
 *     clock and a server clock disagree - it is clamped and flagged, never
 *     drawn at a negative offset
 */
function buildTree(spans: TraceSpan[]): {
  roots: TraceNode[]
  traceStart: number
  traceEnd: number
} {
  if (spans.length === 0) return { roots: [], traceStart: 0, traceEnd: 0 }

  const byId = new Map<string, TraceSpan>()
  for (const span of spans) byId.set(span.span_id, span)

  const childrenOf = new Map<string, TraceSpan[]>()
  const roots: TraceSpan[] = []

  for (const span of spans) {
    const parentId = span.parent_id
    if (parentId && byId.has(parentId)) {
      const bucket = childrenOf.get(parentId)
      if (bucket) bucket.push(span)
      else childrenOf.set(parentId, [span])
    } else {
      roots.push(span)
    }
  }

  // The origin is the earliest *root*, not the earliest span. A child whose
  // clock runs behind its parent's would otherwise drag the whole timeline
  // backwards and push the real root to a non-zero offset.
  const traceStart = Math.min(...roots.map((s) => s.started_at))
  const traceEnd = Math.max(
    traceStart,
    ...spans.map((s) => Math.max(traceStart, s.started_at) + (s.ms ?? 0)),
  )

  const nodes: TraceNode[] = []
  const seen = new Set<string>()

  const walk = (span: TraceSpan, depth: number, parentStart: number): TraceNode => {
    // A cycle should be impossible, but a malformed frame must not hang the UI.
    if (seen.has(span.span_id)) {
      return { span, children: [], depth, offsetMs: 0, skewed: false }
    }
    seen.add(span.span_id)

    const skewed = span.started_at < parentStart
    const effectiveStart = skewed ? parentStart : span.started_at
    const node: TraceNode = {
      span,
      children: [],
      depth,
      offsetMs: Math.max(0, effectiveStart - traceStart),
      skewed,
    }
    const kids = childrenOf.get(span.span_id) || []
    kids.sort((a, b) => a.started_at - b.started_at)
    node.children = kids.map((kid) => walk(kid, depth + 1, effectiveStart))
    return node
  }

  roots.sort((a, b) => a.started_at - b.started_at)
  for (const root of roots) nodes.push(walk(root, 0, root.started_at))

  return { roots: nodes, traceStart, traceEnd }
}

/** Depth-first flatten, for the waterfall's one-row-per-span layout. */
function flattenTree(roots: TraceNode[]): TraceNode[] {
  const out: TraceNode[] = []
  const push = (node: TraceNode) => {
    out.push(node)
    for (const child of node.children) push(child)
  }
  for (const root of roots) push(root)
  return out
}

export const collector = {
  openTrace,
  addSpan,
  addSpans,
  closeTrace,
  adoptServerRun,
  get,
  has,
  list,
  clear,
  traces,
}

export const traceCount = computed(() => traces.size)

export { buildTree, flattenTree }
export type { CollectedTrace }
