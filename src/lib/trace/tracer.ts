/**
 * The browser tracer.
 *
 * Mints the trace id at the interaction, before any network call - so the
 * composer work, the attachment reads and the Electron protocol hop are all
 * inside the trace rather than invisible in front of it.
 *
 * There is no AsyncLocalStorage in a browser, so parenting uses an explicit
 * stack. `span(name, fn)` pushes for the duration of `fn`; anything genuinely
 * concurrent should use `startSpan` and pass the parent itself.
 *
 * See docs/plans/tracing.md §1, §5.
 */

import { newSpanId, newTraceId } from './ids'
import { traceLevel, tracingActive } from './devMode'
import { collector } from './collector'
import type { SpanKind, TraceLevel, TraceSpan, TraceTier } from './types'

const TIER: TraceTier = 'browser'

/** Matches the backend cap so a client cannot outrun the server's budget. */
const MAX_SPANS_PER_TRACE = 2000

type ActiveTrace = {
  traceId: string
  rootSpanId: string
  level: TraceLevel
  startedAt: number
  startedPerf: number
  spanCount: number
  stack: string[]
}

let active: ActiveTrace | null = null

function now(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

export type LiveClientSpan = {
  readonly id: string
  readonly traceId: string
  attr(key: string, value: string | number | boolean): LiveClientSpan
  mark(name: string): LiveClientSpan
  end(outcome?: { ok?: boolean; error?: unknown }): void
}

const NOOP_SPAN: LiveClientSpan = {
  id: '',
  traceId: '',
  attr() {
    return NOOP_SPAN
  },
  mark() {
    return NOOP_SPAN
  },
  end() {
    /* nothing */
  },
}

function errorToSpanError(error: unknown) {
  if (!error) return null
  if (error instanceof Error) {
    return { message: error.message.slice(0, 500) }
  }
  return { message: String(error).slice(0, 500) }
}

function emit(span: TraceSpan): void {
  collector.addSpan(span)
}

function makeSpan(
  name: string,
  parentId: string | null,
  kind: SpanKind,
  attrs: Record<string, string | number | boolean> | undefined,
  trace: ActiveTrace,
): { record: TraceSpan; live: LiveClientSpan } {
  const startedPerf = now()
  const record: TraceSpan = {
    trace_id: trace.traceId,
    span_id: newSpanId(),
    parent_id: parentId,
    name,
    kind,
    tier: TIER,
    started_at: Date.now(),
    ms: null,
    ok: null,
    attrs: { ...(attrs || {}) },
  }
  emit(record)

  let ended = false
  const live: LiveClientSpan = {
    get id() {
      return record.span_id
    },
    get traceId() {
      return record.trace_id
    },
    attr(key, value) {
      record.attrs[key] = value
      return live
    },
    mark(markName) {
      record.attrs[`mark.${markName}`] = Math.round(now() - startedPerf)
      return live
    },
    end(outcome = {}) {
      if (ended) return
      ended = true
      record.ms = Math.round(now() - startedPerf)
      record.ok = outcome.ok !== false && !outcome.error
      if (outcome.error) record.error = errorToSpanError(outcome.error)
      emit(record)
    },
  }

  return { record, live }
}

/**
 * Begin a trace for one user action. This is the root - everything the action
 * touches, on any tier, hangs off it.
 */
export function startAction(
  name: string,
  options: { attrs?: Record<string, string | number | boolean> } = {},
): { traceId: string; end: (outcome?: { ok?: boolean; error?: unknown }) => void } | null {
  if (!tracingActive.value) return null

  const traceId = newTraceId()
  const trace: ActiveTrace = {
    traceId,
    rootSpanId: newSpanId(),
    level: traceLevel.value,
    startedAt: Date.now(),
    startedPerf: now(),
    spanCount: 1,
    stack: [],
  }

  const record: TraceSpan = {
    trace_id: traceId,
    span_id: trace.rootSpanId,
    parent_id: null,
    name,
    kind: 'action',
    tier: TIER,
    started_at: trace.startedAt,
    ms: null,
    ok: null,
    attrs: { ...(options.attrs || {}) },
  }

  collector.openTrace({
    trace_id: traceId,
    root_name: name,
    entry_tier: TIER,
    status: 'running',
    started_at: trace.startedAt,
    span_count: 0,
    level: trace.level,
    open: true,
  })
  emit(record)

  active = trace
  trace.stack.push(trace.rootSpanId)

  let ended = false
  return {
    traceId,
    end(outcome = {}) {
      if (ended) return
      ended = true
      record.ms = Math.round(now() - trace.startedPerf)
      record.ok = outcome.ok !== false && !outcome.error
      if (outcome.error) record.error = errorToSpanError(outcome.error)
      emit(record)
      collector.closeTrace(traceId, {
        status: record.ok ? 'ok' : 'error',
        ended_at: Date.now(),
        total_ms: record.ms,
        error_message: record.error?.message ?? null,
      })
      if (active?.traceId === traceId) active = null
    },
  }
}

/** The span anything started right now would parent itself under. */
export function currentSpanId(): string | null {
  if (!active) return null
  return active.stack[active.stack.length - 1] ?? active.rootSpanId
}

export function currentTraceId(): string | null {
  return active?.traceId ?? null
}

export function currentLevel(): TraceLevel {
  return active?.level ?? traceLevel.value
}

/** The context an outbound request should carry. */
export function outboundContext(): { traceId: string; spanId: string; sampled: boolean } | null {
  const traceId = currentTraceId()
  const spanId = currentSpanId()
  if (!traceId || !spanId) return null
  return { traceId, spanId, sampled: true }
}

export function startSpan(
  name: string,
  options: {
    kind?: SpanKind
    parentId?: string | null
    attrs?: Record<string, string | number | boolean>
  } = {},
): LiveClientSpan {
  if (!active) return NOOP_SPAN
  if (active.spanCount >= MAX_SPANS_PER_TRACE) return NOOP_SPAN
  active.spanCount += 1
  const parentId = options.parentId ?? currentSpanId()
  const { live } = makeSpan(name, parentId, options.kind || 'internal', options.attrs, active)
  return live
}

/**
 * Run `fn` inside a span. Synchronous and async both work; the span closes
 * however `fn` ends.
 */
export function span<T>(
  name: string,
  fn: (s: LiveClientSpan) => T,
  options: { kind?: SpanKind; attrs?: Record<string, string | number | boolean> } = {},
): T {
  if (!active) return fn(NOOP_SPAN)

  const live = startSpan(name, options)
  if (live === NOOP_SPAN) return fn(NOOP_SPAN)

  const trace = active
  trace.stack.push(live.id)

  const pop = () => {
    const index = trace.stack.lastIndexOf(live.id)
    if (index >= 0) trace.stack.splice(index, 1)
  }

  let result: T
  try {
    result = fn(live)
  } catch (error) {
    pop()
    live.end({ ok: false, error })
    throw error
  }

  const maybeThenable = result as unknown as Promise<unknown>
  if (maybeThenable && typeof maybeThenable.then === 'function') {
    // Pop immediately: anything started after the await is a sibling, not a
    // child, and a browser has no way to tell us otherwise.
    pop()
    return maybeThenable.then(
      (value) => {
        live.end({ ok: true })
        return value
      },
      (error) => {
        live.end({ ok: false, error })
        throw error
      },
    ) as unknown as T
  }

  pop()
  live.end({ ok: true })
  return result
}

/** Test seam. */
export function resetTracerForTests(): void {
  active = null
}

export const tracer = {
  startAction,
  startSpan,
  span,
  currentSpanId,
  currentTraceId,
  currentLevel,
  outboundContext,
}
