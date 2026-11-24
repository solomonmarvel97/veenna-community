/**
 * The span contract. Mirrors backend/modules/veenna_tracing/span.js - the two
 * are kept honest by tests/unit/modules/veenna_tracing/contract.test.js.
 *
 * See docs/plans/tracing.md §2.
 */

/** Where a span physically ran. */
export type TraceTier = 'browser' | 'electron-main' | 'api' | 'worker' | 'device'

/** What kind of work a span represents. Drives colour and grouping in the viewer. */
export type SpanKind =
  | 'action'
  | 'ui'
  | 'ipc'
  | 'http'
  | 'db'
  | 'cache'
  | 'queue'
  | 'llm'
  | 'tool'
  | 'device'
  | 'external'
  | 'internal'

/** What the tracer is allowed to capture. Ordered weakest → strongest. */
export type TraceLevel = 'off' | 'errors' | 'on' | 'verbose'

export const TRACE_LEVELS: TraceLevel[] = ['off', 'errors', 'on', 'verbose']

export const TRACE_TIERS: TraceTier[] = ['browser', 'electron-main', 'api', 'worker', 'device']

export const SPAN_KINDS: SpanKind[] = [
  'action',
  'ui',
  'ipc',
  'http',
  'db',
  'cache',
  'queue',
  'llm',
  'tool',
  'device',
  'external',
  'internal',
]

export type SpanAttrValue = string | number | boolean

export type SpanError = {
  message: string
  code?: string
  stack?: string
}

export type TraceSpan = {
  trace_id: string
  span_id: string
  /** null on the root only */
  parent_id: string | null
  /** Dotted, low cardinality - never an id or a path. */
  name: string
  kind: SpanKind
  tier: TraceTier
  /** epoch ms - wall clock, used only for ordering across processes */
  started_at: number
  /** null while the span is open */
  ms: number | null
  ok: boolean | null
  error?: SpanError | null
  attrs: Record<string, SpanAttrValue>
  /** verbose only, redacted, absent when not captured */
  payload?: unknown
  /** other span ids this one caused */
  links?: string[] | null
  /** The worker this span's work was for. Null for the owner's own work. */
  worker_id?: string | null
}

export type TraceStatus = 'running' | 'ok' | 'error' | 'aborted'

export type TraceRun = {
  trace_id: string
  user_id?: string | null
  /** The worker the action was for, when a worker did it. */
  worker_id?: string | null
  root_name: string
  entry_tier: TraceTier
  status: TraceStatus
  started_at: number
  ended_at?: number | null
  total_ms?: number | null
  span_count: number
  error_message?: string | null
  level: TraceLevel
  app_version?: string | null
  platform?: string | null
  attrs?: Record<string, SpanAttrValue>
  /** true while spans are still arriving */
  open?: boolean
  /** came from the server's ring buffer rather than its table */
  live?: boolean
}

export type TraceDetail = {
  trace: TraceRun
  spans: TraceSpan[]
  live: boolean
}

/** A span arranged into the tree the viewer draws. */
export type TraceNode = {
  span: TraceSpan
  children: TraceNode[]
  depth: number
  /** ms from the trace start - clamped to the parent when clocks disagree */
  offsetMs: number
  /** true when this span claims to have started before its parent did */
  skewed: boolean
}

/** What this account is allowed to turn on. */
export type TraceSettings = {
  baseline: TraceLevel
  max: TraceLevel
  levels: TraceLevel[]
  can_read: boolean
  can_manage: boolean
  production: boolean
}

export function isTraceLevel(value: unknown): value is TraceLevel {
  return typeof value === 'string' && (TRACE_LEVELS as string[]).includes(value)
}

export function traceLevelRank(level: TraceLevel): number {
  const index = TRACE_LEVELS.indexOf(level)
  return index < 0 ? 0 : index
}

export function traceLevelAtLeast(level: TraceLevel, floor: TraceLevel): boolean {
  return traceLevelRank(level) >= traceLevelRank(floor)
}
