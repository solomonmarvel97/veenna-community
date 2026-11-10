<script setup lang="ts">
import { computed } from 'vue'
import {
  buildRatingSegments,
  clampGaugeScore,
  RATING_SEGMENT_INACTIVE_OVERLAY,
  RATING_SEGMENT_INACTIVE_SOLID,
} from '@/components/shared/scoreGaugeSegments'

const props = withDefaults(
  defineProps<{
    /** Score from 0-100 */
    score: number
    size?: 'sm' | 'md' | 'lg' | 'xl'
    /** Shown after the rounded score (e.g. "%"). Pass empty string to hide. */
    suffix?: string
    /** Scale to parent height (e.g. list row); width follows arc aspect ratio. */
    fillHeight?: boolean
    /** Inactive segment fill: overlay (lists) or solid (card backgrounds). */
    inactiveVariant?: 'overlay' | 'solid'
  }>(),
  {
    size: 'md',
    suffix: '%',
    fillHeight: false,
    inactiveVariant: 'overlay',
  },
)

const clampedScore = computed(() => clampGaugeScore(Number(props.score)))
const scoreDisplay = computed(() => String(Math.round(clampedScore.value)))

const inactiveColor = computed(() =>
  props.inactiveVariant === 'solid'
    ? RATING_SEGMENT_INACTIVE_SOLID
    : RATING_SEGMENT_INACTIVE_OVERLAY,
)

const ratingSegments = computed(() =>
  buildRatingSegments(clampedScore.value, 'arc', inactiveColor.value),
)

const wrapperClass = computed(() => {
  if (props.fillHeight) {
    return 'relative h-full w-auto shrink-0 aspect-[120/68] min-h-[4.5rem] max-w-[10.5rem] [container-type:size]'
  }
  if (props.size === 'xl') return 'relative mx-auto w-full max-w-[20rem] sm:max-w-[23rem]'
  if (props.size === 'lg') return 'relative mx-auto w-full max-w-[18rem] sm:max-w-[20rem]'
  if (props.size === 'sm') return 'relative w-[6.75rem] shrink-0 sm:w-[7.25rem]'
  return 'relative w-full max-w-[13rem] shrink-0 sm:max-w-[14.5rem]'
})

const scoreTextStyle = computed(() =>
  props.fillHeight ? { fontSize: 'clamp(0.75rem, 26cqh, 2.25rem)' } : undefined,
)

const scoreClass = computed(() => {
  if (props.fillHeight) {
    return 'font-mono font-normal leading-none text-inherit'
  }
  if (props.size === 'xl')
    return 'font-mono text-hero font-normal leading-none text-inherit sm:text-hero'
  if (props.size === 'lg')
    return 'font-mono text-hero font-normal leading-none text-inherit sm:text-hero'
  if (props.size === 'sm')
    return 'font-mono text-title font-normal leading-none text-inherit sm:text-page-title'
  return 'font-mono text-stat font-normal leading-none text-inherit'
})

const scoreOverlayClass = computed(() => {
  if (props.fillHeight) {
    return 'pointer-events-none absolute inset-0 flex items-end justify-center pb-[20cqh]'
  }
  return 'pointer-events-none absolute inset-0 flex items-center justify-center'
})

const scoreOffsetClass = computed(() => {
  if (props.fillHeight) return ''
  if (props.size === 'xl') return 'pb-0.5 pt-10 sm:pt-11'
  if (props.size === 'lg') return 'pb-1 pt-12 sm:pt-14'
  if (props.size === 'sm') return 'pb-0.5 pt-7 sm:pt-8'
  return 'pb-1 pt-10 sm:pt-11'
})

const strokeWidth = computed(() => {
  if (props.fillHeight) return 9
  if (props.size === 'xl') return 11
  if (props.size === 'lg') return 11
  return props.size === 'sm' ? 8 : 10
})
</script>

<template>
  <div :class="wrapperClass" role="img" :aria-label="`Score ${scoreDisplay}${suffix}`">
    <svg
      :class="fillHeight ? 'block size-full' : 'block w-full'"
      viewBox="0 0 120 68"
      fill="none"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <path
        v-for="(segment, idx) in ratingSegments"
        :key="idx"
        :d="segment.path"
        fill="none"
        :stroke="segment.color"
        :stroke-width="strokeWidth"
        stroke-linecap="butt"
      />
    </svg>
    <div :class="[scoreOverlayClass, scoreOffsetClass]">
      <slot name="score" :display="scoreDisplay" :score="clampedScore">
        <span :class="scoreClass" :style="scoreTextStyle">
          {{ scoreDisplay }}<span v-if="suffix">{{ suffix }}</span>
        </span>
      </slot>
    </div>
  </div>
</template>
