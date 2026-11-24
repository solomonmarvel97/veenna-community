/**
 * "Copy trace" - the single most useful button in the feature, because it
 * turns a bug report into a paste.
 *
 * Clipboard only. This deliberately does not mint a shareable link: a trace is
 * the most sensitive data in the product, and a sharing surface over it is a
 * separate decision with its own review. See docs/plans/tracing.md §13.
 */

import { writeClipboardText } from '@/lib/clipboard/writeClipboardText'
import { buildTree, flattenTree } from './collector'
import type { TraceNode, TraceRun, TraceSpan } from './types'

function pad(value: number, width: number): string {
  return String(value).padStart(width, ' ')
}

function durationLabel(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '   -'
  return `${pad(ms, 5)}ms`
}

/**
 * A readable indented tree plus the raw JSON.
 *
 * The text half is what a human skims in a Slack thread; the JSON half is what
 * gets loaded back into a viewer. Both in one paste, because asking someone to
 * send two things means getting one.
 */
export function traceSummary(run: TraceRun, spans: TraceSpan[]): string {
  const { roots } = buildTree(spans)
  const rows = flattenTree(roots)

  const header = [
    `veenna trace ${run.trace_id}`,
    `action    ${run.root_name}`,
    `status    ${run.status}${run.error_message ? ` - ${run.error_message}` : ''}`,
    `started   ${new Date(run.started_at).toISOString()}`,
    `duration  ${run.total_ms ?? '-'}ms`,
    `spans     ${spans.length}`,
    `level     ${run.level}`,
    run.app_version ? `version   ${run.app_version}` : null,
    run.platform ? `platform  ${run.platform}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const lines = rows.map((node: TraceNode) => {
    const { span } = node
    const indent = '  '.repeat(node.depth)
    const flag = span.ok === false ? '✗' : span.attrs?.mark ? '@' : ' '
    const skew = node.skewed ? ' ~skew' : ''
    const error = span.error ? `  ← ${span.error.message}` : ''
    const marks = Object.entries(span.attrs || {})
      .filter(([key]) => key.startsWith('mark.'))
      .map(([key, value]) => ` ${key.slice(5)}=${value}ms`)
      .join('')
    return `${flag} ${durationLabel(span.ms)} +${pad(node.offsetMs, 5)}ms ${indent}${span.name} [${span.tier}/${span.kind}]${marks}${skew}${error}`
  })

  const json = JSON.stringify({ trace: run, spans }, null, 2)

  return `${header}\n\n${lines.join('\n')}\n\n--- json ---\n${json}\n`
}

/**
 * @returns true when the clipboard accepted it
 */
export async function copyTraceToClipboard(run: TraceRun, spans: TraceSpan[]): Promise<boolean> {
  return writeClipboardText(traceSummary(run, spans))
}
