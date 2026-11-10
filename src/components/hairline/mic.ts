/**
 * Mic: a Hairline figure for "nothing recorded yet". A desk microphone waits
 * behind a row of flat waveform tabs.
 */
import {
  TILT,
  boxPaths,
  clamp,
  createProjection,
  falloff,
  mountFigure,
  moveSpring,
  parameter,
  roundedPlate,
  type HairlineFigure,
  type HairlineOptions,
  type Spring,
} from './core'

const REACH_TABLE: readonly [number, number, number] = [1.4, 2.4, 4] // tabs
const LIFT_TABLE: readonly [number, number, number] = [6, 12, 20] // viewBox units

const SCALE = 3.6
const project = createProjection(SCALE, 146, 100)

// Base plate, in world units.
const PLATE_L = 86
const PLATE_D = 44
const PLATE_T = 2
const PLATE_R = 5

// Tabs, spaced like Plot's.
const TAB_COUNT = 7
const TAB_FIRST_X = 13
const TAB_PITCH = 10
const TAB_W = 6
const TAB_Y: readonly [number, number] = [28, 36]

// Microphone. Radii and lengths below are viewBox units, drawn head-on.
const MIC_X = 44
const MIC_Y = 11
const BASE_RX = 38
const BASE_RY = BASE_RX * TILT
const BASE_H = 7
const POLE_H = 30
const POLE_HALF_W = 2
const YOKE_R = 34
const CAPSULE_R = 26
const CAPSULE_HALF_LEN = 26

// Lean, in degrees. The head rests turned a little toward the tabs.
const HEAD_REST = -3
const HEAD_LEAN = 10
const STAND_LEAN = 2.5
const LEAN_RANGE = 170

const WAVE_LIFT = 0.65

/** Front half of a ring seen from above, as an arc from left to right. */
function ring(cx: number, y: number, rx: number, ry: number): string {
  return `M${cx - rx} ${y}A${rx} ${ry} 0 0 0 ${cx + rx} ${y}`
}

function capsule(cx: number, cy: number): string {
  const r = CAPSULE_R
  const l = CAPSULE_HALF_LEN
  return (
    `M${cx - r} ${cy - l}A${r} ${r} 0 0 1 ${cx + r} ${cy - l}` +
    `L${cx + r} ${cy + l}A${r} ${r} 0 0 1 ${cx - r} ${cy + l}Z`
  )
}

export function mic(element: HTMLElement, options: HairlineOptions = {}): HairlineFigure {
  return mountFigure(element, options, {
    name: 'mic',
    label: 'A microphone waiting, with a flat waveform',
    waveMs: 3200,
    activeCaption: 'listening',
    waveCaption: 'hello',
    build({ svg, mk }) {
      // Back to front: plate, microphone, then tabs from far to near.
      mk(svg, 'path', { class: 'sil', d: roundedPlate(project, PLATE_L, PLATE_D, PLATE_R, 0) })
      mk(svg, 'path', {
        class: 'sil',
        d: roundedPlate(project, PLATE_L, PLATE_D, PLATE_R, PLATE_T),
      })

      const [baseX, baseFloorY] = project(MIC_X, MIC_Y, PLATE_T)
      const baseTopY = baseFloorY - BASE_H
      const poleTopY = baseTopY - POLE_H
      const pivotY = poleTopY - YOKE_R

      mk(svg, 'path', {
        class: 'sil',
        d:
          `M${baseX - BASE_RX} ${baseTopY}L${baseX - BASE_RX} ${baseFloorY}` +
          `A${BASE_RX} ${BASE_RY} 0 0 0 ${baseX + BASE_RX} ${baseFloorY}` +
          `L${baseX + BASE_RX} ${baseTopY}Z`,
      })
      mk(svg, 'ellipse', { class: 'sil', cx: baseX, cy: baseTopY, rx: BASE_RX, ry: BASE_RY })
      mk(svg, 'circle', { class: 'hi nf', cx: baseX, cy: baseTopY + BASE_RY * 0.6, r: 2.6 })

      const stand = mk(svg, 'g', {})
      mk(stand, 'path', {
        class: 'sil',
        d:
          `M${baseX - POLE_HALF_W} ${baseTopY}L${baseX - POLE_HALF_W} ${poleTopY}` +
          `L${baseX + POLE_HALF_W} ${poleTopY}L${baseX + POLE_HALF_W} ${baseTopY}Z`,
      })
      mk(stand, 'path', {
        class: 'sil nf',
        d: `M${baseX - YOKE_R} ${pivotY}A${YOKE_R} ${YOKE_R} 0 0 0 ${baseX + YOKE_R} ${pivotY}`,
      })

      const head = mk(stand, 'g', {})
      mk(head, 'path', {
        class: 'sil nf',
        d:
          `M${baseX - YOKE_R} ${pivotY}L${baseX - CAPSULE_R} ${pivotY}` +
          `M${baseX + CAPSULE_R} ${pivotY}L${baseX + YOKE_R} ${pivotY}`,
      })
      const body = mk(head, 'path', { class: 'sil', d: capsule(baseX, pivotY) })
      const beltY = pivotY + CAPSULE_HALF_LEN - 5
      mk(head, 'path', {
        class: 'sil nf',
        d:
          ring(baseX, beltY, CAPSULE_R, CAPSULE_R * 0.4) +
          ring(baseX, beltY + 8, CAPSULE_R, CAPSULE_R * 0.4),
      })
      for (const offset of [-32, -19, -6]) {
        const halfWidth =
          offset < -CAPSULE_HALF_LEN
            ? Math.sqrt(CAPSULE_R ** 2 - (offset + CAPSULE_HALF_LEN) ** 2)
            : CAPSULE_R
        mk(head, 'path', {
          class: 'nf',
          d: ring(baseX, pivotY + offset, halfWidth, halfWidth * 0.4),
        })
      }
      for (const side of [-1, 1]) {
        mk(stand, 'circle', { class: 'sil', cx: baseX + side * YOKE_R, cy: pivotY, r: 3 })
      }

      const tabs = Array.from({ length: TAB_COUNT }, (_, i) => {
        const center = TAB_FIRST_X + i * TAB_PITCH
        const group = mk(svg, 'g', {})
        return {
          center,
          screenX: project(center, (TAB_Y[0] + TAB_Y[1]) / 2, PLATE_T)[0],
          outline: mk(group, 'path', { class: 'sil' }),
          creases: mk(group, 'path', { class: 'sil nf' }),
          spring: { x: 0, v: 0 } as Spring,
        }
      })
      const pitchX = TAB_PITCH * SCALE * Math.SQRT1_2
      const lean: Spring = { x: 0, v: 0 }

      return (input) => {
        const reach = parameter(REACH_TABLE, input.intensity)
        const lift = parameter(LIFT_TABLE, input.intensity)

        let waveCenter: number | null = null
        if (input.wave !== null) {
          const eased = (1 - Math.cos(input.wave * Math.PI)) / 2
          waveCenter = -reach + eased * (TAB_COUNT - 1 + 2 * reach)
        }

        let settled = true
        tabs.forEach((tab, index) => {
          let target = 0
          if (input.engaged) {
            const distance = Math.abs(input.pointerX - tab.screenX) / pitchX
            const voice = input.reduced
              ? 1
              : 0.86 + 0.14 * Math.sin((input.now / 1000) * (6 + index * 0.9) + index * 1.9)
            target = lift * falloff(distance, reach) * voice
          } else if (waveCenter !== null) {
            target = lift * WAVE_LIFT * falloff(Math.abs(index - waveCenter), reach)
          }
          if (!moveSpring(tab.spring, target, input)) settled = false

          const height = Math.max(0, tab.spring.x)
          const paths = boxPaths(
            project,
            [tab.center - TAB_W / 2, tab.center + TAB_W / 2],
            TAB_Y,
            PLATE_T,
            height,
          )
          tab.outline.setAttribute('d', paths.outline)
          tab.creases.setAttribute('d', paths.creases)
          tab.outline.classList.toggle('hi', height > lift * 0.5)
        })

        let leanTarget = 0
        if (input.engaged) {
          leanTarget = clamp((input.pointerX - baseX) / LEAN_RANGE, -1, 1)
        } else if (waveCenter !== null) {
          const across = clamp(waveCenter / (TAB_COUNT - 1), 0, 1)
          leanTarget = clamp((tabs[0].screenX - baseX) / LEAN_RANGE, -1, 1) * (1 - across) * 0.6
        }
        if (!moveSpring(lean, leanTarget, input)) settled = false

        stand.setAttribute(
          'transform',
          `rotate(${(lean.x * STAND_LEAN).toFixed(3)} ${baseX} ${baseTopY})`,
        )
        head.setAttribute(
          'transform',
          `rotate(${(HEAD_REST + lean.x * HEAD_LEAN).toFixed(3)} ${baseX} ${pivotY})`,
        )
        body.classList.toggle('hi', input.engaged || waveCenter !== null)
        return { settled }
      }
    },
  })
}
