import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { HairlineFigure, HairlineOptions } from './core'

/** Mounts a figure on the returned ref and keeps it in step with the component's props. */
export function useHairline(
  draw: (element: HTMLElement, options: HairlineOptions) => HairlineFigure,
  props: HairlineOptions,
) {
  const root = ref<HTMLElement | null>(null)
  let figure: HairlineFigure | null = null

  const options = (): HairlineOptions => ({
    intensity: props.intensity,
    theme: props.theme,
    label: props.label,
    onRead: props.onRead,
    play: props.play,
  })

  watch(options, (next) => figure?.update(next))

  onMounted(() => {
    if (root.value) figure = draw(root.value, options())
  })

  onBeforeUnmount(() => {
    figure?.destroy()
    figure = null
  })

  return root
}
