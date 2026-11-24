/** Local-only tracing for the community app: spans are kept in memory and on this device. */
export {
  developerModeEnabled,
  traceLevel,
  tracingActive,
  verboseActive,
  setDeveloperMode,
  DEVELOPER_MODE_STORAGE_KEY,
} from './devMode'
export { tracer, startAction, startSpan, span, currentSpanId, currentTraceId, currentLevel, outboundContext, resetTracerForTests, type LiveClientSpan } from './tracer'
export { collector, buildTree, flattenTree, traceCount, type CollectedTrace } from './collector'
export { newTraceId, newSpanId, isTraceId, isSpanId } from './ids'
export { TRACE_LEVELS, TRACE_TIERS, SPAN_KINDS, isTraceLevel, traceLevelRank, traceLevelAtLeast, type TraceLevel, type TraceTier, type SpanKind, type TraceSpan, type TraceRun, type TraceNode, type TraceDetail, type TraceStatus } from './types'
export { traceSummary, copyTraceToClipboard } from './copy'
