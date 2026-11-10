/**
 * What every local Hairline figure shares: the options, camera, stylesheet and
 * frame loop. Same API and drawing rules as the figures in
 * @lucasmarkes/hairline, written standalone because that package does not
 * export its stage helpers.
 */

export type HairlineTheme = 'auto' | 'light' | 'dark'

export interface HairlineOptions {
  /** 0 to 1: how far the figure's answer reaches, and how strongly. Default 0.5. */
  intensity?: number
  theme?: HairlineTheme
  /** Accessible name. */
  label?: string
  /** The figure's caption, once at mount and each time it changes. */
  onRead?: (text: string) => void
  /** Loops the figure's answer until the pointer or focus arrives. */
  play?: boolean
}

export interface HairlineFigure {
  /** A key set to undefined goes back to its default; a key left out stays. */
  update(options: HairlineOptions): void
  destroy(): void
}

export interface Spring {
  x: number
  v: number
}

export type Point = readonly [number, number]

export const VIEW_W = 400
export const VIEW_H = 320

// Camera: 45 degrees, half tilt, as the Hairline figures use.
export const TILT = 0.5
const Z_FACTOR = 0.86

const SVG_NS = 'http://www.w3.org/2000/svg'
const STYLE_ID = 'hairline-figure-styles'

const SPRING_K = 90
const SPRING_C = 14
export const SPRING_EPS = 0.02
const SPRING_HZ = 240

const WAVE_REST_MS = 2000
const WAVE_START_MS = 600
const WAVE_RESUME_MS = 1400
const TOUCH_LEAVE_MS = 1400

const STYLES = `
[data-hairline-figure] {
  --hl-plate: var(--hairline-plate, #ffffff);
  --hl-hi: var(--hairline-hi, #232327);
  --hl-edge: var(--hairline-edge, #a4a4ac);
  --hl-mid: var(--hairline-mid, #c3c3c9);
  --hl-lo: var(--hairline-lo, #e0e0e4);
  --hl-sw: var(--hairline-stroke, 0.9);
}
:where([data-hairline-figure]) {
  display: block;
  width: 100%;
  aspect-ratio: 5 / 4;
}
@supports (color: light-dark(#000, #fff)) {
  [data-hairline-figure] {
    --hl-plate: var(--hairline-plate, light-dark(#ffffff, #08090a));
    --hl-hi: var(--hairline-hi, light-dark(#232327, #d0d6e0));
    --hl-edge: var(--hairline-edge, light-dark(#a4a4ac, #5b5d64));
    --hl-mid: var(--hairline-mid, light-dark(#c3c3c9, #3e3e44));
    --hl-lo: var(--hairline-lo, light-dark(#e0e0e4, #29292d));
  }
}
.dark [data-hairline-figure],
[data-theme='dark'] [data-hairline-figure],
[data-hairline-figure][data-hairline-theme='dark'] {
  --hl-plate: var(--hairline-plate, #08090a);
  --hl-hi: var(--hairline-hi, #d0d6e0);
  --hl-edge: var(--hairline-edge, #5b5d64);
  --hl-mid: var(--hairline-mid, #3e3e44);
  --hl-lo: var(--hairline-lo, #29292d);
}
[data-theme='light'] [data-hairline-figure],
[data-hairline-figure][data-hairline-theme='light'] {
  --hl-plate: var(--hairline-plate, #ffffff);
  --hl-hi: var(--hairline-hi, #232327);
  --hl-edge: var(--hairline-edge, #a4a4ac);
  --hl-mid: var(--hairline-mid, #c3c3c9);
  --hl-lo: var(--hairline-lo, #e0e0e4);
}
[data-hairline-figure] svg {
  display: block;
  width: 100%;
  height: 100%;
}
[data-hairline-figure] svg :is(path, circle, ellipse) {
  fill: var(--hl-plate);
  stroke: var(--hl-mid);
  stroke-width: var(--hl-sw);
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
  transition: stroke 180ms ease;
}
[data-hairline-figure] svg .sil { stroke: var(--hl-edge); }
[data-hairline-figure] svg .lo { stroke: var(--hl-lo); }
[data-hairline-figure] svg .hi { stroke: var(--hl-hi); }
[data-hairline-figure] svg .nf { fill: none; }
@media (prefers-reduced-motion: reduce) {
  [data-hairline-figure] svg :is(path, circle, ellipse) { transition: none; }
}
`

export function createProjection(scale: number, ox: number, oy: number) {
  return (x: number, y: number, z: number): Point => [
    ox + scale * (x - y) * Math.SQRT1_2,
    oy + scale * ((x + y) * Math.SQRT1_2 * TILT - z * Z_FACTOR),
  ]
}

export function pathOf(points: readonly Point[], close = false): string {
  const body = points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join('')
  return close ? `${body}Z` : body
}

/** A rounded rectangle lying flat at height z, as a closed path. */
export function roundedPlate(
  project: (x: number, y: number, z: number) => Point,
  length: number,
  depth: number,
  radius: number,
  z: number,
): string {
  const corners: ReadonlyArray<readonly [number, number, number]> = [
    [length - radius, radius, -90],
    [length - radius, depth - radius, 0],
    [radius, depth - radius, 90],
    [radius, radius, 180],
  ]
  const points: Point[] = []
  for (const [cx, cy, start] of corners) {
    for (let degrees = start; degrees <= start + 90; degrees += 15) {
      const radians = (degrees * Math.PI) / 180
      points.push(project(cx + radius * Math.cos(radians), cy + radius * Math.sin(radians), z))
    }
  }
  return pathOf(points, true)
}

/** Outline of an upright box, and the three edges that meet at its near corner. */
export function boxPaths(
  project: (x: number, y: number, z: number) => Point,
  [x0, x1]: readonly [number, number],
  [y0, y1]: readonly [number, number],
  floor: number,
  height: number,
): { outline: string; creases: string } {
  const top = floor + height
  const nearTop = project(x1, y1, top)
  const rightTop = project(x1, y0, top)
  const leftTop = project(x0, y1, top)
  return {
    outline: pathOf(
      [
        project(x0, y0, top),
        rightTop,
        project(x1, y0, floor),
        project(x1, y1, floor),
        project(x0, y1, floor),
        leftTop,
      ],
      true,
    ),
    creases:
      height < SPRING_EPS
        ? ''
        : pathOf([leftTop, nearTop, rightTop]) + pathOf([nearTop, project(x1, y1, floor)]),
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Value at intensity 0, 0.5 and 1. */
export function parameter(table: readonly [number, number, number], value: number): number {
  const [lo, mid, hi] = table
  const i = clamp(value, 0, 1)
  return i <= 0.5 ? lo + (i / 0.5) * (mid - lo) : mid + ((i - 0.5) / 0.5) * (hi - mid)
}

export function falloff(distance: number, reach: number): number {
  if (distance >= reach) return 0
  return Math.cos(((distance / reach) * Math.PI) / 2) ** 2
}

function injectStyles(doc: Document) {
  if (doc.getElementById(STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = STYLES
  doc.head.append(style)
}

function stepSpring(spring: Spring, target: number, dt: number) {
  const steps = Math.max(1, Math.round(dt * SPRING_HZ))
  const h = dt / steps
  for (let step = 0; step < steps; step += 1) {
    spring.v += (SPRING_K * (target - spring.x) - SPRING_C * spring.v) * h
    spring.x += spring.v * h
  }
}

export interface FrameInput {
  now: number
  dt: number
  engaged: boolean
  pointerX: number
  pointerY: number
  reduced: boolean
  intensity: number
  /** 0 to 1 through the play wave, or null when it is not running. */
  wave: number | null
}

/** Moves a spring toward its target, and says whether it has settled there. */
export function moveSpring(spring: Spring, target: number, input: FrameInput): boolean {
  if (input.reduced) {
    spring.x = target
    spring.v = 0
    return true
  }
  stepSpring(spring, target, input.dt)
  return Math.abs(target - spring.x) < SPRING_EPS && Math.abs(spring.v) < SPRING_EPS
}

export interface Stage {
  svg: Element
  mk: (parent: Element, tag: string, attrs: Record<string, string | number>) => Element
}

export interface FigureSpec {
  name: string
  label: string
  waveMs: number
  /** Caption while the pointer or focus is on the figure. */
  activeCaption: string
  /** Caption while `play` runs. */
  waveCaption: string
  /** Draws the rest pose once, and returns the per-frame update. */
  build: (stage: Stage) => (input: FrameInput) => { settled: boolean }
}

export function mountFigure(
  element: HTMLElement,
  options: HairlineOptions,
  spec: FigureSpec,
): HairlineFigure {
  if (typeof document === 'undefined' || !(element instanceof Element)) {
    throw new Error(`${spec.name}: expected a DOM element`)
  }

  let opts: HairlineOptions = { ...options }

  injectStyles(element.ownerDocument)
  element.setAttribute('data-hairline-figure', spec.name)
  element.setAttribute('role', 'img')

  const mk: Stage['mk'] = (parent, tag, attrs) => {
    const node = element.ownerDocument.createElementNS(SVG_NS, tag)
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value))
    parent.append(node)
    return node
  }

  const svg = mk(element, 'svg', {
    viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
    'aria-hidden': 'true',
  })
  const update = spec.build({ svg, mk })

  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null
  let reduced = media?.matches === true

  let hovering = false
  let focused = false
  let pointerX = VIEW_W / 2
  let pointerY = VIEW_H / 2
  let waveAt = performance.now() + WAVE_START_MS
  let lastFrame = 0
  let raf = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let touchTimer: ReturnType<typeof setTimeout> | undefined
  let caption: string | null = null
  let destroyed = false

  const isEngaged = () => hovering || focused
  const wantsWave = () => opts.play === true && !reduced && !isEngaged()

  function read(text: string) {
    if (text === caption) return
    caption = text
    try {
      opts.onRead?.(text)
    } catch (error) {
      reportError(error)
    }
  }

  function applyTheme() {
    if (opts.theme === 'light' || opts.theme === 'dark') {
      element.setAttribute('data-hairline-theme', opts.theme)
    } else {
      element.removeAttribute('data-hairline-theme')
    }
  }

  function applyLabel() {
    if (element.hasAttribute('aria-labelledby')) return
    element.setAttribute('aria-label', opts.label ?? spec.label)
  }

  function frame() {
    raf = 0
    const now = performance.now()
    const dt = Math.min(0.05, (now - (lastFrame || now)) / 1000)
    lastFrame = now

    const engaged = isEngaged()
    let wave: number | null = null
    if (wantsWave() && now >= waveAt) {
      const progress = (now - waveAt) / spec.waveMs
      if (progress < 1) wave = progress
      else waveAt = now + WAVE_REST_MS
    }

    const { settled } = update({
      now,
      dt,
      engaged,
      pointerX,
      pointerY,
      reduced,
      intensity: opts.intensity ?? 0.5,
      wave,
    })
    read(engaged ? spec.activeCaption : wave !== null ? spec.waveCaption : 'rest')

    if (!reduced && (!settled || engaged || wave !== null)) {
      wake()
    } else {
      lastFrame = 0
      if (wantsWave()) {
        clearTimeout(timer)
        timer = setTimeout(wake, Math.max(0, waveAt - now))
      }
    }
  }

  function wake() {
    // A timer can outlive the window (test teardown, closed document).
    if (raf !== 0 || destroyed || typeof requestAnimationFrame === 'undefined') return
    raf = requestAnimationFrame(frame)
  }

  function refresh() {
    clearTimeout(timer)
    wake()
  }

  function leave() {
    hovering = false
    waveAt = performance.now() + WAVE_RESUME_MS
    refresh()
  }

  function onPointerMove(event: PointerEvent) {
    clearTimeout(touchTimer)
    const rect = (svg as SVGElement).getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      pointerX = ((event.clientX - rect.left) / rect.width) * VIEW_W
      pointerY = ((event.clientY - rect.top) / rect.height) * VIEW_H
    }
    hovering = true
    refresh()
  }

  function onPointerLeave(event: PointerEvent) {
    if (event.pointerType === 'touch') {
      clearTimeout(touchTimer)
      touchTimer = setTimeout(leave, TOUCH_LEAVE_MS)
      return
    }
    leave()
  }

  function onFocusIn() {
    focused = true
    if (!hovering) {
      pointerX = VIEW_W / 2
      pointerY = VIEW_H / 2
    }
    refresh()
  }

  function onFocusOut() {
    focused = false
    waveAt = performance.now() + WAVE_RESUME_MS
    refresh()
  }

  function onMotionChange() {
    reduced = media?.matches === true
    refresh()
  }

  element.addEventListener('pointerenter', onPointerMove)
  element.addEventListener('pointermove', onPointerMove)
  element.addEventListener('pointerleave', onPointerLeave)
  element.addEventListener('pointercancel', onPointerLeave)
  element.addEventListener('focusin', onFocusIn)
  element.addEventListener('focusout', onFocusOut)
  media?.addEventListener('change', onMotionChange)

  applyTheme()
  applyLabel()
  update({
    now: performance.now(),
    dt: 0,
    engaged: false,
    pointerX,
    pointerY,
    reduced: true,
    intensity: opts.intensity ?? 0.5,
    wave: null,
  })
  read('rest')
  if (wantsWave()) timer = setTimeout(wake, WAVE_START_MS)

  return {
    update(next) {
      opts = { ...opts, ...next }
      applyTheme()
      applyLabel()
      refresh()
    },
    destroy() {
      destroyed = true
      if (raf !== 0) cancelAnimationFrame(raf)
      clearTimeout(timer)
      clearTimeout(touchTimer)
      element.removeEventListener('pointerenter', onPointerMove)
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerleave', onPointerLeave)
      element.removeEventListener('pointercancel', onPointerLeave)
      element.removeEventListener('focusin', onFocusIn)
      element.removeEventListener('focusout', onFocusOut)
      media?.removeEventListener('change', onMotionChange)
      svg.remove()
      element.removeAttribute('data-hairline-figure')
      element.removeAttribute('data-hairline-theme')
      element.removeAttribute('role')
      if (!element.hasAttribute('aria-labelledby')) element.removeAttribute('aria-label')
    },
  }
}
