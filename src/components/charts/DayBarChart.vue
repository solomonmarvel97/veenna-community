<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { format as formatDate, parseISO } from 'date-fns'

const loopDayLabel = (day: string) => formatDate(parseISO(day), 'MMM d')

/**
 * The product's one daily bar chart, as the Docket draws it: a labelled Y axis, solid axis
 * lines with dashed gridlines, stacked bars, date ticks along the bottom, a tooltip on the
 * hovered day, and a sideways scroll (opening on the latest day) instead of squeezed bars
 * when the window is long. Pickers and legends live in the panel around it.
 */
export type DayBarSeries = {
  key: string
  label: string
  /** Any CSS colour; the first series sits at the bottom of each stack. */
  color: string
  values: number[]
}

const props = withDefaults(
  defineProps<{
    /** One ISO day (YYYY-MM-DD) per bar, oldest first. */
    days: string[]
    series: DayBarSeries[]
    /** How a value reads on the axis and in the tooltip. */
    format?: (n: number) => string
    /** Whole numbers only: the axis top is an even integer (counts). Off for money. */
    integers?: boolean
    /** What the last tick says instead of its date ("Today"). */
    lastLabel?: string
    /** What one unit is called in the tooltip's total ("task done"); omit for no total line. */
    noun?: string
    nounPlural?: string
    emptyText?: string
    loading?: boolean
  }>(),
  {
    format: (n: number) => n.toLocaleString(),
    integers: false,
    lastLabel: '',
    noun: '',
    nounPlural: '',
    emptyText: 'Nothing in this period.',
    loading: false,
  },
)

const BAR = 6
const GAP = 4
/** Screen pixels per day: a longer window scrolls sideways instead of squeezing its bars. */
const DAY_PX = 14
const HEIGHT = 100

const hovered = ref<number | null>(null)
const scroller = ref<HTMLElement | null>(null)

const totals = computed(() =>
  props.days.map((_, i) => props.series.reduce((a, s) => a + (s.values[i] ?? 0), 0)),
)
const peak = computed(() => Math.max(0, ...totals.value))
const sum = computed(() => totals.value.reduce((a, b) => a + b, 0))

/** The axis top: a round number at or above the peak, so the middle tick reads cleanly too. */
const max = computed(() => {
  const p = peak.value
  // Small counts: an even whole number, so the middle tick is whole too; larger ones use round numbers.
  if (props.integers && p <= 20) return p <= 2 ? 2 : Math.ceil(p / 2) * 2
  if (p <= 0) return 1
  const pow = 10 ** Math.floor(Math.log10(p))
  const frac = p / pow
  return (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10) * pow
})
const yTicks = computed(() => [max.value, max.value / 2, 0])
const width = computed(() => Math.max(1, props.days.length) * (BAR + GAP) - GAP)
const innerMin = computed(() => `${props.days.length * DAY_PX}px`)

const bars = computed(() =>
  props.days.map((day, i) => {
    let y = HEIGHT
    const parts = props.series.map((s) => {
      const value = s.values[i] ?? 0
      const h = (value / max.value) * HEIGHT
      y -= h
      return { key: s.key, color: s.color, y, h, value }
    })
    return { day, x: i * (BAR + GAP), total: totals.value[i], top: y, parts }
  }),
)

/** Every few days (fewer ticks as the window grows), counted back from the last, so the last tick is always shown. */
const xTicks = computed(() => {
  const n = props.days.length
  const step = n <= 8 ? 1 : n <= 16 ? 2 : n <= 35 ? 5 : n <= 100 ? 14 : 45
  return props.days
    .map((day, i) => ({
      day,
      left: ((i * (BAR + GAP) + BAR / 2) / width.value) * 100,
      label: i === n - 1 && props.lastLabel ? props.lastLabel : loopDayLabel(day),
      show: (n - 1 - i) % step === 0,
    }))
    .filter((t) => t.show)
})

/** A new window opens on its latest day, the right-hand end. */
watch(
  () => props.days.length,
  () =>
    void nextTick(() => scroller.value && (scroller.value.scrollLeft = scroller.value.scrollWidth)),
  { flush: 'post', immediate: true },
)

const hoveredBar = computed(() =>
  hovered.value == null ? null : (bars.value[hovered.value] ?? null),
)

/**
 * Places the tooltip over the hovered bar: above it when there is room, beside it when
 * the bar is tall (the panel clips anything that leaves it), hanging inward near the edges.
 */
const tooltipStyle = computed(() => {
  const bar = hoveredBar.value
  if (!bar) return null
  const leftPct = ((bar.x + BAR / 2) / width.value) * 100
  const top = bar.total > 0 ? bar.top : HEIGHT - 1.5
  const topPct = (top / HEIGHT) * 100
  if (topPct >= 45) {
    const shiftX = leftPct < 20 ? '-12px' : leftPct > 80 ? 'calc(-100% + 12px)' : '-50%'
    return {
      left: `${leftPct}%`,
      top: `${topPct}%`,
      transform: `translate(${shiftX}, calc(-100% - 8px))`,
    }
  }
  const onLeft = leftPct > 55
  return {
    left: `${leftPct}%`,
    top: `${topPct}%`,
    transform: onLeft ? 'translateX(calc(-100% - 14px))' : 'translateX(14px)',
  }
})

const unit = (n: number) => (n === 1 ? props.noun : props.nounPlural)
</script>

<template>
  <div class="flex min-h-32 min-w-0 flex-col">
    <div
      v-if="loading && !days.length"
      class="min-h-32 flex-1 animate-pulse rounded-sm bg-muted/50"
    />
    <template v-else>
      <div class="flex min-h-0 flex-1 gap-2">
        <div class="flex w-9 shrink-0 flex-col" aria-hidden="true">
          <div class="relative flex-1 text-label tabular-nums text-muted-foreground">
            <span
              v-for="(tick, i) in yTicks"
              :key="i"
              class="absolute right-0 -translate-y-1/2 whitespace-nowrap leading-none"
              :style="{ top: `${i * 50}%` }"
              >{{ format(tick) }}</span
            >
          </div>
          <div class="mt-1.5 h-4 shrink-0" />
        </div>
        <div ref="scroller" class="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div class="flex h-full flex-col" :style="{ minWidth: innerMin }">
            <div class="relative flex-1 border-b border-l border-veenna-divider">
              <div
                v-for="line in 2"
                :key="line"
                class="pointer-events-none absolute inset-x-0 border-t border-dashed border-veenna-divider"
                :style="{ top: `${(line - 1) * 50}%` }"
                aria-hidden="true"
              />
              <svg
                :viewBox="`0 0 ${width} ${HEIGHT}`"
                preserveAspectRatio="none"
                class="absolute inset-0 h-full w-full"
                role="img"
                :aria-label="`${format(sum)} over ${days.length} days`"
                @mouseleave="hovered = null"
              >
                <g v-for="(bar, i) in bars" :key="bar.day" @mouseenter="hovered = i">
                  <rect
                    :x="bar.x - GAP / 2"
                    y="0"
                    :width="BAR + GAP"
                    :height="HEIGHT"
                    fill="transparent"
                  />
                  <rect
                    v-if="bar.total === 0"
                    :x="bar.x"
                    :y="HEIGHT - 1.5"
                    :width="BAR"
                    height="1.5"
                    class="fill-current text-foreground/10"
                  />
                  <template v-for="part in bar.parts" :key="part.key">
                    <rect
                      v-if="part.h > 0"
                      :x="bar.x"
                      :y="part.y"
                      :width="BAR"
                      :height="part.h"
                      :fill="part.color"
                      class="transition-opacity"
                      :class="hovered != null && hovered !== i ? 'opacity-40' : ''"
                    />
                  </template>
                </g>
              </svg>
              <div
                v-if="hoveredBar && tooltipStyle"
                role="tooltip"
                class="pointer-events-none absolute z-10 min-w-36 rounded-sm bg-popover px-3 py-2 text-label text-popover-foreground shadow-md"
                :style="tooltipStyle"
              >
                <slot name="tooltip" :index="hovered" :day="hoveredBar.day">
                  <p class="mb-1.5 font-semibold text-foreground">
                    {{ loopDayLabel(hoveredBar.day) }}
                  </p>
                  <p
                    v-for="(s, k) in series"
                    :key="s.key"
                    class="flex items-center justify-between gap-4 tabular-nums"
                  >
                    <span class="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span
                        class="size-2 rounded-sm"
                        :style="{ backgroundColor: s.color }"
                        aria-hidden="true"
                      />
                      {{ s.label }}
                    </span>
                    {{ format(hoveredBar.parts[k]?.value ?? 0) }}
                  </p>
                  <p
                    v-if="noun"
                    class="mt-1.5 flex items-center justify-between gap-4 border-t border-veenna-divider pt-1.5 tabular-nums"
                  >
                    <span class="text-muted-foreground">Total</span>
                    {{ format(hoveredBar.total) }} {{ unit(hoveredBar.total) }}
                  </p>
                </slot>
              </div>
              <p
                v-if="sum === 0"
                class="absolute inset-0 flex items-center justify-center text-caption text-muted-foreground"
              >
                {{ emptyText }}
              </p>
            </div>
            <div class="relative mt-1.5 h-4 shrink-0 text-label tabular-nums text-muted-foreground">
              <span
                v-for="t in xTicks"
                :key="t.day"
                class="absolute -translate-x-1/2 whitespace-nowrap"
                :class="t.left > 92 ? '!-translate-x-full' : t.left < 8 ? '!translate-x-0' : ''"
                :style="{ left: t.left > 92 ? '100%' : t.left < 8 ? '0%' : `${t.left}%` }"
                >{{ t.label }}</span
              >
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
