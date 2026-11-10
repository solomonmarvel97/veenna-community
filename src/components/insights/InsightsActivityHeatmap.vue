<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { format, parseISO } from 'date-fns'
import { buildActivityHeatmap, type HeatmapLevel } from '@/lib/activityHeatmap'
import { veennaUi } from '@/lib/veennaUi'
import type { VoiceInsightsHeatmapPoint } from '@/types/insights'
import { useDictationStore } from '@/stores/dictation'

const props = defineProps<{
  points: VoiceInsightsHeatmapPoint[]
  dayStreak: number
  longestStreak: number
}>()

const CELL_PX = 11
const GAP_PX = 3
const LABEL_COL_PX = 28
const MIN_WEEKS = 13
/** Allow >1 year so wide layouts fill to the right edge instead of leaving a gap. */
const MAX_WEEKS = 104

const dictationStore = useDictationStore()
const hovered = ref<{ date: string; words: number; x: number; y: number } | null>(null)
const gridHostRef = ref<HTMLElement | null>(null)
const weekCount = ref(52)

watch(
  () => dictationStore.overlayVisible,
  (visible) => {
    if (visible) hovered.value = null
  },
)

const grid = computed(() => buildActivityHeatmap(props.points, weekCount.value))

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const cellStyle = {
  width: `${CELL_PX}px`,
  height: `${CELL_PX}px`,
}

const tipLabel = computed(() => {
  if (!hovered.value) return ''
  const day = format(parseISO(hovered.value.date), 'EEE, MMM d')
  return `${day} · ${hovered.value.words.toLocaleString()} words`
})

function weeksForWidth(width: number): number {
  // Weekday labels + gap before the first week column.
  const usable = Math.max(0, width - LABEL_COL_PX - GAP_PX)
  const slot = CELL_PX + GAP_PX
  const fitted = Math.floor((usable + GAP_PX) / slot)
  return Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, fitted || MIN_WEEKS))
}

function measureWeeks() {
  const el = gridHostRef.value
  if (!el) return
  const next = weeksForWidth(el.clientWidth)
  if (next !== weekCount.value) weekCount.value = next
}

let resizeObserver: ResizeObserver | null = null

function bindHost(el: HTMLElement | null) {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (!el) return
  measureWeeks()
  // Remeasure after layout/reveal settles so we don't lock to a narrow first paint.
  requestAnimationFrame(() => measureWeeks())
  if (typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(() => measureWeeks())
  resizeObserver.observe(el)
}

onMounted(() => bindHost(gridHostRef.value))

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

watch(gridHostRef, (el) => bindHost(el))

function levelClass(level: HeatmapLevel, inRange: boolean): string {
  if (!inRange) return 'opacity-0'
  return `insights-heat--${level}`
}

function tip(event: MouseEvent | FocusEvent, date: string, words: number) {
  if (dictationStore.overlayVisible) return
  const target = event.currentTarget
  if (!(target instanceof HTMLElement)) return
  const rect = target.getBoundingClientRect()
  hovered.value = {
    date,
    words,
    x: rect.left + rect.width / 2,
    y: rect.top,
  }
}

function clearTip() {
  hovered.value = null
}
</script>

<template>
  <div :class="[veennaUi.settingsCard, 'insights-heatmap flex h-full w-full min-w-0 flex-col']">
    <div :class="veennaUi.settingsGroupHeader">
      <h3 :class="veennaUi.settingsGroupLabel">{{ dayStreak }} day streak</h3>
      <p class="text-caption tabular-nums text-veenna-muted">
        Longest <span class="text-veenna-fg">{{ longestStreak }} days</span>
      </p>
    </div>

    <div
      ref="gridHostRef"
      class="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-x-auto px-4 py-5"
    >
      <div class="inline-block">
        <div
          class="relative mb-1"
          :style="{
            height: '12px',
            marginLeft: `${LABEL_COL_PX + GAP_PX}px`,
          }"
        >
          <span
            v-for="month in grid.months"
            :key="`${month.label}-${month.weekIndex}`"
            class="absolute bottom-0 whitespace-nowrap text-micro leading-none text-veenna-muted"
            :style="{ left: `${month.weekIndex * (CELL_PX + GAP_PX)}px` }"
          >
            {{ month.label }}
          </span>
        </div>

        <div class="flex" :style="{ gap: `${GAP_PX}px` }">
          <div
            class="flex shrink-0 flex-col"
            :style="{ width: `${LABEL_COL_PX}px`, gap: `${GAP_PX}px`, paddingRight: '4px' }"
          >
            <span
              v-for="(label, i) in weekdayLabels"
              :key="label"
              class="flex items-center text-micro leading-none text-veenna-muted"
              :style="{ height: `${CELL_PX}px` }"
            >
              <template v-if="i % 2 === 1">{{ label }}</template>
            </span>
          </div>

          <div class="flex" :style="{ gap: `${GAP_PX}px` }">
            <div
              v-for="(week, wi) in grid.weeks"
              :key="wi"
              class="flex shrink-0 flex-col"
              :style="{ gap: `${GAP_PX}px` }"
            >
              <button
                v-for="cell in week.cells"
                :key="cell.date"
                type="button"
                class="insights-heat shrink-0 rounded-[2px] transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-veenna-accent"
                :class="levelClass(cell.level, cell.inRange)"
                :style="cellStyle"
                :aria-label="`${format(parseISO(cell.date), 'MMM d, yyyy')}: ${cell.words} words`"
                :disabled="!cell.inRange"
                @mouseenter="tip($event, cell.date, cell.words)"
                @mouseleave="clearTip"
                @focus="tip($event, cell.date, cell.words)"
                @blur="clearTip"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      class="flex flex-col gap-2 border-t border-veenna-divider px-4 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3"
    >
      <div class="flex items-center gap-1.5 text-micro text-veenna-muted">
        <span>Less</span>
        <span
          v-for="level in [0, 1, 2, 3, 4] as HeatmapLevel[]"
          :key="level"
          class="insights-heat h-2.5 w-2.5 rounded-[2px]"
          :class="`insights-heat--${level}`"
        />
        <span>More</span>
      </div>
      <div class="flex items-center gap-1.5 text-micro text-veenna-muted">
        <span class="insights-heat h-2.5 w-2.5 rounded-[2px] insights-heat--3" />
        Current streak
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="hovered"
        class="insights-heat-tip pointer-events-none fixed z-[40] -translate-x-1/2 -translate-y-full rounded-md px-2 py-1 text-caption font-medium shadow-lg"
        :style="{ left: `${hovered.x}px`, top: `${hovered.y - 8}px` }"
        role="tooltip"
      >
        {{ tipLabel }}
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.insights-heat--0 {
  background: color-mix(in srgb, var(--veenna-fg) 12%, transparent);
}
.insights-heat--1 {
  background: color-mix(in srgb, var(--veenna-heatmap-accent) 42%, transparent);
}
.insights-heat--2 {
  background: color-mix(in srgb, var(--veenna-heatmap-accent) 66%, transparent);
}
.insights-heat--3 {
  background: color-mix(in srgb, var(--veenna-heatmap-accent) 86%, transparent);
}
.insights-heat--4 {
  background: var(--veenna-heatmap-accent);
}
</style>

<style>
.insights-heat-tip {
  background: var(--veenna-fg);
  color: var(--veenna-bg);
  white-space: nowrap;
}
</style>
