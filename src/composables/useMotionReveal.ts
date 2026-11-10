import {
  type Ref,
  type MaybeRefOrGetter,
  onMounted,
  onBeforeUnmount,
  onActivated,
  nextTick,
  toValue,
} from 'vue'

export interface UseMotionRevealOptions {
  childSelector?: string
  replayOnActivate?: boolean
  enabled?: MaybeRefOrGetter<boolean>
  duration?: number
  stagger?: number
  ease?: string
  y?: number
}

/** Motion.dev route reveals are disabled - show sections immediately. */
export function useMotionReveal(
  root: Ref<HTMLElement | null | undefined>,
  options: UseMotionRevealOptions = {},
) {
  const {
    childSelector = '[data-section-reveal]',
    replayOnActivate = true,
    enabled = true,
  } = options

  function play() {
    if (!toValue(enabled)) return
    const el = root.value
    if (!el) return

    const nodes = el.querySelectorAll<HTMLElement>(childSelector)
    for (const node of nodes) {
      node.style.opacity = '1'
      node.style.transform = 'none'
    }
  }

  onMounted(() => {
    nextTick(play)
  })

  onActivated(() => {
    if (replayOnActivate) nextTick(play)
  })

  onBeforeUnmount(() => {})
}
