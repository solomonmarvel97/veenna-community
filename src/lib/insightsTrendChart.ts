/** Layout helpers for the Insights words-over-time chart. */

export function niceScale(maxValue: number, tickCount = 4): { max: number; ticks: number[] } {
  const safeMax = Math.max(0, maxValue)
  if (safeMax <= 0) return { max: 1, ticks: [0, 1] }

  const count = Math.max(2, tickCount)
  const rough = safeMax / (count - 1)
  const mag = 10 ** Math.floor(Math.log10(rough))
  const residual = rough / mag
  const step = residual >= 7 ? 10 * mag : residual >= 3 ? 5 * mag : residual >= 1.5 ? 2 * mag : mag
  const max = Math.ceil(safeMax / step) * step
  const ticks: number[] = []
  for (let value = 0; value <= max + step / 2; value += step) {
    ticks.push(Number(value.toPrecision(12)))
  }
  return { max, ticks }
}

/** Evenly spaced indices including the first and last point. */
export function pickXTickIndices(length: number, maxTicks = 7): number[] {
  if (length <= 0) return []
  if (length <= maxTicks) return Array.from({ length }, (_, i) => i)
  const last = length - 1
  const count = maxTicks
  const indices = new Set<number>()
  for (let i = 0; i < count; i++) {
    indices.add(Math.round((i * last) / (count - 1)))
  }
  return [...indices].sort((a, b) => a - b)
}

/** Center of the i-th bar slot in a 0–100 plot, for axis labels and tooltips. */
export function barSlotCenter(index: number, length: number): number {
  if (length <= 0) return 50
  if (length === 1) return 50
  const slot = 100 / length
  return slot * index + slot / 2
}
