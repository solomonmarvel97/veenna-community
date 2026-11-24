/**
 * Shared presentation helpers for the trace viewer.
 *
 * Colour carries meaning here: `kind` says what the work was, and the eye
 * should be able to find the LLM call and the tool calls in a 200-row
 * waterfall without reading a single label.
 */

import type { SpanKind, TraceSpan, TraceTier } from '@/lib/trace/types'

/** One hue per kind, tuned to read in both themes. */
export const KIND_COLORS: Record<SpanKind, string> = {
  action: 'var(--veenna-accent)',
  ui: '#8b5cf6',
  ipc: '#a855f7',
  http: '#3b82f6',
  db: '#14b8a6',
  cache: '#06b6d4',
  queue: '#f59e0b',
  llm: '#ec4899',
  tool: '#22c55e',
  device: '#f97316',
  external: '#64748b',
  internal: '#94a3b8',
}

export const KIND_LABELS: Record<SpanKind, string> = {
  action: 'Action',
  ui: 'UI',
  ipc: 'IPC',
  http: 'HTTP',
  db: 'Database',
  cache: 'Cache',
  queue: 'Queue',
  llm: 'Model',
  tool: 'Tool',
  device: 'Device',
  external: 'External',
  internal: 'Internal',
}

export const TIER_LABELS: Record<TraceTier, string> = {
  browser: 'Browser',
  'electron-main': 'Desktop',
  api: 'API',
  worker: 'Worker',
  device: 'Device',
}

export function kindColor(kind: SpanKind): string {
  return KIND_COLORS[kind] || KIND_COLORS.internal
}

export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '-'
  if (ms < 1) return '<1ms'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)}s`
}

export function formatClock(epochMs: number | null | undefined): string {
  if (!epochMs) return '-'
  try {
    return new Date(epochMs).toLocaleTimeString(undefined, {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return '-'
  }
}

/** Marks live in attrs under a `mark.` prefix - see tracer.mark. */
export function spanMarks(span: TraceSpan): Array<{ name: string; ms: number }> {
  const out: Array<{ name: string; ms: number }> = []
  for (const [key, value] of Object.entries(span.attrs || {})) {
    if (!key.startsWith('mark.')) continue
    if (typeof value !== 'number') continue
    out.push({ name: key.slice(5), ms: value })
  }
  return out.sort((a, b) => a.ms - b.ms)
}

/** Attributes worth showing in the inspector - marks are drawn on the bar instead. */
export function displayAttrs(span: TraceSpan): Array<[string, string]> {
  return Object.entries(span.attrs || {})
    .filter(([key]) => !key.startsWith('mark.') && key !== 'mark')
    .map(([key, value]) => [key, String(value)] as [string, string])
    .sort((a, b) => a[0].localeCompare(b[0]))
}

/** A span still open has no duration yet; the viewer draws it as running. */
export function isRunning(span: TraceSpan): boolean {
  return span.ms === null || span.ms === undefined
}
