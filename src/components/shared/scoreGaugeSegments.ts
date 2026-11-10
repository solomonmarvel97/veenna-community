const RATING_SEGMENT_COLORS = [
  '#ef4444',
  '#f97316',
  '#fb923c',
  '#f59e0b',
  '#facc15',
  '#a3e635',
  '#84cc16',
  '#4ade80',
  '#38bdf8',
  '#22d3ee',
] as const

export const RATING_SEGMENT_INACTIVE_OVERLAY = 'rgba(100, 116, 139, 0.35)'
export const RATING_SEGMENT_INACTIVE_SOLID =
  'color-mix(in srgb, var(--veenna-muted) 28%, var(--veenna-panel))'

const RATING_SEGMENT_COUNT = 10

export type ScoreGaugeLayout = 'arc' | 'ring'

const LAYOUT_SWEEP: Record<ScoreGaugeLayout, { start: number; end: number }> = {
  arc: { start: -180, end: 0 },
  ring: { start: -90, end: 270 },
}

export function clampGaugeScore(score: number): number {
  if (!Number.isFinite(score)) return 0
  return Math.min(100, Math.max(0, score))
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function buildArcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, startDeg)
  const end = polar(cx, cy, r, endDeg)
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

export type RatingSegment = { path: string; color: string }

export function buildRatingSegments(
  score: number,
  layout: ScoreGaugeLayout,
  inactiveColor: string,
): RatingSegment[] {
  const clamped = clampGaugeScore(score)
  const { start, end } = LAYOUT_SWEEP[layout]
  const totalSweep = end - start
  const gapDeg = 3
  const segSweep = (totalSweep - gapDeg * (RATING_SEGMENT_COUNT - 1)) / RATING_SEGMENT_COUNT
  const activeCount = Math.max(0, Math.min(RATING_SEGMENT_COUNT, Math.ceil(clamped / 10)))

  return Array.from({ length: RATING_SEGMENT_COUNT }, (_, i) => {
    const segStart = start + i * (segSweep + gapDeg)
    const segEnd = segStart + segSweep
    const color = i < activeCount ? RATING_SEGMENT_COLORS[i] : inactiveColor
    return { path: buildArcPath(60, 60, 44, segStart, segEnd), color }
  })
}
