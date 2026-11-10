/**
 * Checklist: a Hairline figure for "nothing to do yet". A sheet of four empty
 * rows lies on a clipboard, with a pencil waiting at the first box. The nearest
 * row lifts and the pencil slides over to tick it.
 */
import {
  boxPaths,
  clamp,
  createProjection,
  falloff,
  mountFigure,
  moveSpring,
  parameter,
  pathOf,
  roundedPlate,
  type HairlineFigure,
  type HairlineOptions,
  type Point,
  type Spring,
} from './core'

const REACH_TABLE: readonly [number, number, number] = [1, 1.6, 2.6] // rows
const LIFT_TABLE: readonly [number, number, number] = [2.5, 5, 9] // world units

const SCALE = 3.4
const project = createProjection(SCALE, 210, 96)

// Clipboard, in world units.
const BOARD_L = 66
const BOARD_D = 74
const BOARD_T = 2
const BOARD_R = 5
const CLIP_X: readonly [number, number] = [22, 44]
const CLIP_Y: readonly [number, number] = [-2, 6]
const CLIP_H = 3.5

// Rows.
const ROW_COUNT = 4
const ROW_FIRST_Y = 19
const ROW_PITCH = 15
const BOX_X: readonly [number, number] = [8, 17]
const BOX_HALF_D = 4.5
const LINE_X: readonly [number, number] = [22, 58]
const LINE_HALF_D = 1.6

// Pencil, drawn head-on in viewBox units with its tip at the origin.
const PENCIL_TILT = 28
const PENCIL_HALF_W = 7
const PENCIL_LEN = 118
const PENCIL_CONE = 20
const PENCIL_BAND = 16
const PENCIL_LIFT = 7

const TICK_MIN = 0.02
const TICK_FROM = 0.35
const WAVE_LIFT = 0.65

/** The first `progress` of a polyline, so a tick can draw itself in. */
function partial(points: readonly Point[], progress: number): readonly Point[] {
  const lengths = points
    .slice(1)
    .map(([x, y], index) => Math.hypot(x - points[index][0], y - points[index][1]))
  let left = clamp(progress, 0, 1) * lengths.reduce((sum, length) => sum + length, 0)
  const drawn: Point[] = [points[0]]
  for (let index = 0; index < lengths.length; index += 1) {
    const [x0, y0] = points[index]
    const [x1, y1] = points[index + 1]
    const share = Math.min(1, left / lengths[index])
    drawn.push([x0 + (x1 - x0) * share, y0 + (y1 - y0) * share])
    left -= lengths[index]
    if (left <= 0) break
  }
  return drawn
}

export function checklist(element: HTMLElement, options: HairlineOptions = {}): HairlineFigure {
  return mountFigure(element, options, {
    name: 'checklist',
    label: 'An empty checklist, with a pencil ready',
    waveMs: 3600,
    activeCaption: 'ticking',
    waveCaption: 'ticking',
    build({ svg, mk }) {
      mk(svg, 'path', { class: 'sil', d: roundedPlate(project, BOARD_L, BOARD_D, BOARD_R, 0) })
      mk(svg, 'path', {
        class: 'sil',
        d: roundedPlate(project, BOARD_L, BOARD_D, BOARD_R, BOARD_T),
      })
      const clip = boxPaths(project, CLIP_X, CLIP_Y, BOARD_T, CLIP_H)
      mk(svg, 'path', { class: 'sil', d: clip.outline })
      mk(svg, 'path', { class: 'sil nf', d: clip.creases })

      const rows = Array.from({ length: ROW_COUNT }, (_, i) => {
        const y = ROW_FIRST_Y + i * ROW_PITCH
        const group = mk(svg, 'g', {})
        return {
          y,
          screenY: project((LINE_X[0] + LINE_X[1]) / 2, y, BOARD_T)[1],
          box: mk(group, 'path', { class: 'sil' }),
          boxCreases: mk(group, 'path', { class: 'sil nf' }),
          line: mk(group, 'path', { class: 'lo' }),
          lineCreases: mk(group, 'path', { class: 'lo nf' }),
          tick: mk(group, 'path', { class: 'hi nf' }),
          lift: { x: 0, v: 0 } as Spring,
          ticked: { x: 0, v: 0 } as Spring,
        }
      })
      const pitchY = rows[1].screenY - rows[0].screenY

      const pencil = mk(svg, 'g', {})
      const w = PENCIL_HALF_W
      const end = PENCIL_LEN
      mk(pencil, 'path', {
        class: 'sil',
        d:
          `M0 0L${-w} ${-PENCIL_CONE}L${-w} ${-end}A${w} ${w} 0 0 1 ${w} ${-end}` +
          `L${w} ${-PENCIL_CONE}Z`,
      })
      mk(pencil, 'path', {
        class: 'sil nf',
        d:
          `M${-w} ${-PENCIL_CONE}L${w} ${-PENCIL_CONE}` +
          `M${-w} ${-(end - PENCIL_BAND)}L${w} ${-(end - PENCIL_BAND)}`,
      })
      const pen: Spring = { x: 0, v: 0 }

      return (input) => {
        const reach = parameter(REACH_TABLE, input.intensity)
        const lift = parameter(LIFT_TABLE, input.intensity)
        const waveRow = input.wave === null ? null : -0.5 + input.wave * (ROW_COUNT + 0.5)
        const pointerRow = (input.pointerY - rows[0].screenY) / pitchY

        let settled = true
        rows.forEach((row, index) => {
          let liftTarget = 0
          let tickTarget = 0
          if (input.engaged) {
            const near = falloff(Math.abs(pointerRow - index), reach)
            liftTarget = lift * near
            tickTarget = near > TICK_FROM ? 1 : 0
          } else if (waveRow !== null) {
            liftTarget = lift * WAVE_LIFT * falloff(Math.abs(waveRow - index), reach)
            tickTarget = waveRow >= index ? 1 : 0
          }
          if (!moveSpring(row.lift, liftTarget, input)) settled = false
          if (!moveSpring(row.ticked, tickTarget, input)) settled = false

          const height = Math.max(0, row.lift.x)
          const box = boxPaths(
            project,
            BOX_X,
            [row.y - BOX_HALF_D, row.y + BOX_HALF_D],
            BOARD_T,
            height,
          )
          const line = boxPaths(
            project,
            LINE_X,
            [row.y - LINE_HALF_D, row.y + LINE_HALF_D],
            BOARD_T,
            height,
          )
          row.box.setAttribute('d', box.outline)
          row.boxCreases.setAttribute('d', box.creases)
          row.line.setAttribute('d', line.outline)
          row.lineCreases.setAttribute('d', line.creases)

          const progress = clamp(row.ticked.x, 0, 1)
          const top = BOARD_T + height
          row.tick.setAttribute(
            'd',
            progress < TICK_MIN
              ? ''
              : pathOf(
                  partial(
                    [
                      project(BOX_X[0] + 2.2, row.y + 0.4, top),
                      project(BOX_X[0] + 4, row.y + 2.6, top),
                      project(BOX_X[1] - 1.8, row.y - 2.8, top),
                    ],
                    progress,
                  ),
                ),
          )
          row.box.classList.toggle('hi', progress > 0.5)
        })

        let penTarget = 0
        if (input.engaged) penTarget = clamp(pointerRow, 0, ROW_COUNT - 1)
        else if (waveRow !== null) penTarget = clamp(waveRow, 0, ROW_COUNT - 1)
        if (!moveSpring(pen, penTarget, input)) settled = false

        const [tipX, tipY] = project(
          (BOX_X[0] + BOX_X[1]) / 2,
          ROW_FIRST_Y + pen.x * ROW_PITCH,
          BOARD_T,
        )
        pencil.setAttribute(
          'transform',
          `translate(${tipX.toFixed(2)} ${(tipY - PENCIL_LIFT).toFixed(2)}) rotate(${PENCIL_TILT})`,
        )
        return { settled }
      }
    },
  })
}
