export type WaveBarShape = {
  width: number
  height: number
  radius: number
  x: number
  y: number
}

/** Bar width for a canvas of this height: thin capsules, like a voice recorder. */
export function waveBarWidth(canvasHeight: number): number {
  return Math.min(3.5, Math.max(2, canvasHeight * 0.11))
}

/** Space between bars, relative to bar width. */
export function waveBarGap(barWidth: number): number {
  return Math.max(1.5, barWidth * 0.8)
}

/**
 * Standard wave-bar geometry: a vertically centred capsule.
 *
 * Idle (activity 0): a dot - height === width.
 * Moving: height grows toward the full canvas; the ends stay fully rounded.
 */
export function waveBarShape(options: {
  barWidth: number
  canvasHeight: number
  activity: number
  x: number
}): WaveBarShape {
  const canvasHeight = Math.max(1, options.canvasHeight)
  const width = Math.min(Math.max(1, options.barWidth), canvasHeight)
  const activity = Math.max(0, Math.min(1, options.activity))
  const height = width + activity * Math.max(0, canvasHeight - width)

  return {
    width,
    height,
    radius: width / 2,
    x: options.x,
    y: canvasHeight / 2 - height / 2,
  }
}

export function fillWaveBar(context: CanvasRenderingContext2D, shape: WaveBarShape) {
  context.beginPath()
  if (typeof context.roundRect === 'function') {
    context.roundRect(shape.x, shape.y, shape.width, shape.height, shape.radius)
  } else {
    context.rect(shape.x, shape.y, shape.width, shape.height)
  }
  context.fill()
}
