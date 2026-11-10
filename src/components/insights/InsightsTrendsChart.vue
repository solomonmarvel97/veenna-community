<script setup lang="ts">
import { computed, ref } from 'vue'
import { format, parseISO } from 'date-fns'
import { formatCompactCount } from '@/lib/insightsCopy'
import { veennaUi } from '@/lib/veennaUi'
import { isoDateKey } from '@/lib/dateUtils'
import { barSlotCenter, niceScale, pickXTickIndices } from '@/lib/insightsTrendChart'
import { useDictationStore } from '@/stores/dictation'
import ChartExpand from '@/components/shared/ChartExpand.vue'

const props = defineProps<{
  series: Array<{ date: string; words: number; captures: number }>
}>()

const dictationStore = useDictationStore()
const hovered = ref<number | null>(null)

const recent = computed(() => {
  const sorted = [...props.series]
    .map((row) => ({ ...row, date: isoDateKey(row.date) || row.date }))
    .filter((row) => isoDateKey(row.date))
    .sort((a, b) => a.date.localeCompare(b.date))
  return sorted
})

const scale = computed(() => niceScale(Math.max(0, ...recent.value.map((d) => d.words))))

const totalRecent = computed(() => recent.value.reduce((sum, d) => d.words + sum, 0))
const hasTrend = computed(() => recent.value.some((d) => d.words > 0))

const plot = computed(() => {
  const rows = recent.value
  const { max } = scale.value
  return rows.map((row, i) => ({
    ...row,
    x: barSlotCenter(i, rows.length),
    y: 100 - (row.words / max) * 100,
    barHeight: (row.words / max) * 100,
  }))
})

const barGapClass = computed(() => (recent.value.length > 14 ? 'gap-px' : 'gap-1.5'))

const xTickIndices = computed(() => pickXTickIndices(recent.value.length, 7))

const active = computed(() => {
  if (hovered.value == null) return null
  return plot.value[hovered.value] ?? null
})

function formatDay(date: string, prevDate?: string) {
  const key = isoDateKey(date)
  if (!key) return ''
  try {
    const day = parseISO(key)
    const prev = prevDate ? isoDateKey(prevDate) : null
    if (!prev || parseISO(prev).getMonth() !== day.getMonth()) {
      return format(day, 'MMM d')
    }
    return format(day, 'd')
  } catch {
    return key
  }
}

function formatTipDay(date: string) {
  const key = isoDateKey(date)
  if (!key) return date
  try {
    return format(parseISO(key), 'EEE, MMM d')
  } catch {
    return key
  }
}

function setHover(index: number) {
  if (dictationStore.overlayVisible) return
  hovered.value = index
}

function clearHover() {
  hovered.value = null
}
</script>

<template>
  <ChartExpand title="Words over time" :disabled="!hasTrend" class="h-full" v-slot="{ expanded }">
    <div :class="[veennaUi.settingsCard, 'flex h-full flex-col', expanded && 'flex-1']">
      <!-- Right padding leaves room for the expand button that appears on hover. -->
      <div :class="[veennaUi.settingsGroupHeader, 'pr-12']">
        <h3 :class="veennaUi.settingsGroupLabel">Words over time</h3>
        <p class="text-caption text-veenna-muted">Last {{ recent.length || 30 }} days</p>
      </div>

      <div
        v-if="hasTrend"
        class="flex flex-1 flex-col px-4 pb-3 pt-5"
        :class="expanded ? 'min-h-[26rem]' : 'min-h-[13rem]'"
        @mouseleave="clearHover"
      >
        <div class="flex min-h-0 flex-1">
          <div class="relative w-9 shrink-0 pr-2" aria-hidden="true">
            <span
              v-for="tick in scale.ticks"
              :key="tick"
              class="absolute right-0 -translate-y-1/2 text-micro tabular-nums leading-none text-veenna-muted"
              :style="{ top: `${100 - (tick / scale.max) * 100}%` }"
            >
              {{ formatCompactCount(tick) }}
            </span>
          </div>

          <div class="relative min-w-0 flex-1">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              class="absolute inset-0 h-full w-full overflow-visible"
              role="img"
              :aria-label="`Words dictated over the last ${recent.length} days, ${formatCompactCount(totalRecent)} total`"
            >
              <line
                v-for="tick in scale.ticks"
                :key="`grid-${tick}`"
                x1="0"
                x2="100"
                :y1="100 - (tick / scale.max) * 100"
                :y2="100 - (tick / scale.max) * 100"
                stroke="var(--veenna-divider)"
                stroke-width="1"
                stroke-dasharray="3 4"
                vector-effect="non-scaling-stroke"
              />
            </svg>

            <div class="absolute inset-0 flex items-end" :class="barGapClass">
              <button
                v-for="(point, i) in plot"
                :key="point.date"
                type="button"
                class="relative flex h-full min-w-0 flex-1 cursor-default items-end rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--veenna-focus-line)]"
                :aria-label="`${formatTipDay(point.date)}: ${point.words.toLocaleString()} words`"
                @mouseenter="setHover(i)"
                @focus="setHover(i)"
              >
                <span
                  data-testid="words-bar"
                  class="w-full rounded-[3px] bg-veenna-accent transition-opacity duration-150"
                  :class="active && hovered !== i ? 'opacity-35' : 'opacity-90'"
                  :style="{ height: `${point.barHeight}%` }"
                />
              </button>
            </div>

            <div
              v-if="active"
              class="pointer-events-none absolute z-10 min-w-[8.5rem] rounded-md border border-veenna-border bg-veenna-surface px-2.5 py-2 shadow-veenna-sm"
              :style="{
                left: `${active.x}%`,
                top: `calc(${active.y}% - 8px)`,
                transform: 'translate(-50%, -100%)',
              }"
              role="tooltip"
            >
              <p class="text-micro font-medium uppercase tracking-overline text-veenna-muted">
                {{ formatTipDay(active.date) }}
              </p>
              <p class="mt-1 flex items-center gap-2 text-caption text-veenna-fg">
                <span class="h-2 w-2 shrink-0 rounded-sm bg-veenna-accent" />
                <span>Words</span>
                <span class="ml-auto font-semibold tabular-nums">
                  {{ active.words.toLocaleString() }}
                </span>
              </p>
              <p v-if="active.captures" class="mt-0.5 pl-4 text-label text-veenna-muted">
                {{ active.captures }} capture{{ active.captures === 1 ? '' : 's' }}
              </p>
            </div>
          </div>
        </div>

        <div class="mt-2 flex" aria-hidden="true">
          <div class="w-9 shrink-0" />
          <div
            class="relative h-4 min-w-0 flex-1 text-micro uppercase tracking-overline text-veenna-muted"
          >
            <span
              v-for="index in xTickIndices"
              :key="recent[index].date"
              class="absolute whitespace-nowrap"
              :class="
                index === 0
                  ? 'translate-x-0'
                  : index === recent.length - 1
                    ? '-translate-x-full'
                    : '-translate-x-1/2'
              "
              :style="{ left: `${plot[index].x}%` }"
            >
              {{ formatDay(recent[index].date, index > 0 ? recent[index - 1].date : undefined) }}
            </span>
          </div>
        </div>
      </div>

      <div
        v-else
        class="m-4 flex min-h-[13rem] flex-1 items-center justify-center rounded-md bg-veenna-row text-caption text-veenna-muted"
      >
        Dictate for a few days to see your trend.
      </div>

      <div
        class="flex items-center justify-between gap-3 border-t border-veenna-divider px-4 py-2.5 text-caption text-veenna-muted"
      >
        <span>Total</span>
        <span class="tabular-nums">
          <span class="font-semibold text-veenna-fg">{{ formatCompactCount(totalRecent) }}</span>
          words
        </span>
      </div>
    </div>
  </ChartExpand>
</template>
