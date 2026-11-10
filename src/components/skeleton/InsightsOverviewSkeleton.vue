<script setup lang="ts">
/**
 * The Insights overview before its numbers arrive: the four stat tiles over the
 * activity heatmap and the words-over-time chart, drawn at the loaded cards' own
 * sizes. Labels, legends and axis names are known, so they render as real text;
 * only figures, dates and the chart marks shimmer.
 */
import Skeleton from '@/components/ui/Skeleton.vue'
import { skeletonDelay, skeletonWidth } from '@/lib/skeleton'
import { veennaUi } from '@/lib/veennaUi'

withDefaults(defineProps<{ label?: string }>(), { label: 'Loading insights' })

const tiles = ['Words dictated', 'Speaking pace', 'Veennas completed', 'Workspace setup']
const valueWidths = ['w-20', 'w-14', 'w-10', 'w-16']
const noteWidths = ['w-28', 'w-16', 'w-36', 'w-32']

/** Heatmap geometry matches InsightsActivityHeatmap (11px cells, 3px gaps). */
const WEEKS = 44
const weeks = Array.from({ length: WEEKS }, (_, w) => w)
const days = Array.from({ length: 7 }, (_, d) => d)
const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const monthMarks = [0, 4, 9, 13, 17, 22, 26, 30, 35, 39]
const heatOpacities = [0.28, 0.4, 0.55, 0.7]

/** A repeatable scatter so the grid reads like activity, not a flat block. */
function cellOpacity(week: number, day: number): number {
  const mix = (week * 7 + day * 3 + week * day) % 11
  return heatOpacities[mix % heatOpacities.length] ?? 0.4
}

/** Bar heights (percent) for the words chart: a ragged run with a few spikes. */
const bars = [
  12, 20, 8, 34, 62, 18, 10, 44, 28, 6, 14, 22, 52, 16, 9, 30, 72, 24, 12, 38, 20, 8, 56, 26, 14,
  46, 18, 10, 32, 84,
]
const yTicks = [0, 1, 2, 3, 4]
const xTickLefts = ['0%', '19%', '40%', '61%', '80%', '100%']
</script>

<template>
  <div class="space-y-4" role="status" aria-busy="true" :aria-label="label">
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div v-for="(tile, i) in tiles" :key="tile" :class="[veennaUi.settingsCard, 'flex flex-col']">
        <div :class="veennaUi.settingsGroupHeader">
          <span :class="veennaUi.settingsGroupLabel">{{ tile }}</span>
        </div>
        <div class="flex-1 px-4 py-4">
          <!-- text-stat line box, so the figure lands without moving the card. -->
          <Skeleton class="h-7" :class="skeletonWidth(valueWidths, i)" :delay="skeletonDelay(i)" />
        </div>
        <div class="border-t border-veenna-divider px-4 py-2.5">
          <Skeleton
            class="h-3"
            :class="skeletonWidth(noteWidths, i)"
            :delay="skeletonDelay(i, 30)"
          />
        </div>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <!-- Activity heatmap -->
      <div :class="[veennaUi.settingsCard, 'flex h-full w-full min-w-0 flex-col']">
        <div :class="veennaUi.settingsGroupHeader">
          <Skeleton class="h-2.5 w-24" :delay="skeletonDelay(4)" />
          <p class="flex items-center gap-1.5 text-caption text-veenna-muted">
            Longest
            <Skeleton class="h-3 w-12" :delay="skeletonDelay(4, 20)" />
          </p>
        </div>

        <div
          class="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden px-4 py-5"
        >
          <div class="inline-block max-w-full">
            <div class="relative mb-1 h-3" style="margin-left: 31px">
              <Skeleton
                v-for="(week, m) in monthMarks"
                :key="week"
                class="absolute bottom-0 h-2 w-6"
                :style="{ left: `${week * 14}px` }"
                :delay="skeletonDelay(5 + m)"
              />
            </div>

            <div class="flex" style="gap: 3px">
              <div class="flex shrink-0 flex-col" style="width: 28px; gap: 3px; padding-right: 4px">
                <span
                  v-for="(dayLabel, d) in weekdayLabels"
                  :key="dayLabel"
                  class="flex items-center text-micro leading-none text-veenna-muted"
                  style="height: 11px"
                >
                  <template v-if="d % 2 === 1">{{ dayLabel }}</template>
                </span>
              </div>
              <div class="flex" style="gap: 3px">
                <div v-for="w in weeks" :key="w" class="flex shrink-0 flex-col" style="gap: 3px">
                  <span
                    v-for="d in days"
                    :key="d"
                    class="skeleton-static shrink-0 rounded-[2px]"
                    :style="{ width: '11px', height: '11px', opacity: cellOpacity(w, d) }"
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
              v-for="level in 5"
              :key="level"
              class="skeleton-static h-2.5 w-2.5 rounded-[2px]"
              :style="{ opacity: 0.2 + level * 0.14 }"
            />
            <span>More</span>
          </div>
          <div class="flex items-center gap-1.5 text-micro text-veenna-muted">
            <span class="skeleton-static h-2.5 w-2.5 rounded-[2px]" style="opacity: 0.7" />
            Current streak
          </div>
        </div>
      </div>

      <!-- Words over time -->
      <div :class="[veennaUi.settingsCard, 'flex h-full flex-col']">
        <div :class="[veennaUi.settingsGroupHeader, 'pr-12']">
          <h3 :class="veennaUi.settingsGroupLabel">Words over time</h3>
          <Skeleton class="h-3 w-20" :delay="skeletonDelay(6)" />
        </div>

        <div class="flex min-h-[13rem] flex-1 flex-col px-4 pb-3 pt-5">
          <div class="flex min-h-0 flex-1">
            <div class="relative w-9 shrink-0 pr-2" aria-hidden="true">
              <Skeleton
                v-for="tick in yTicks"
                :key="tick"
                rounded="sm"
                class="absolute right-2 h-2 w-5 -translate-y-1/2"
                :style="{ top: `${tick * 25}%` }"
                :animated="false"
              />
            </div>
            <div class="relative min-w-0 flex-1">
              <div
                v-for="tick in yTicks"
                :key="`grid-${tick}`"
                class="absolute inset-x-0 border-t border-dashed border-veenna-divider"
                :style="{ top: `${tick * 25}%` }"
              />
              <div class="absolute inset-0 flex items-end gap-px">
                <span
                  v-for="(height, b) in bars"
                  :key="b"
                  class="flex h-full min-w-0 flex-1 items-end"
                >
                  <span class="block w-full" :style="{ height: `${height}%` }">
                    <Skeleton
                      rounded="sm"
                      class="h-full w-full"
                      :delay="skeletonDelay(b % 12, 40)"
                    />
                  </span>
                </span>
              </div>
            </div>
          </div>
          <div class="mt-2 flex" aria-hidden="true">
            <div class="w-9 shrink-0" />
            <div class="relative h-4 min-w-0 flex-1">
              <Skeleton
                v-for="(left, t) in xTickLefts"
                :key="left"
                rounded="sm"
                class="absolute top-1 h-2 w-8"
                :class="
                  t === 0
                    ? ''
                    : t === xTickLefts.length - 1
                      ? '-translate-x-full'
                      : '-translate-x-1/2'
                "
                :style="{ left }"
                :animated="false"
              />
            </div>
          </div>
        </div>

        <div
          class="flex items-center justify-between gap-3 border-t border-veenna-divider px-4 py-2.5 text-caption text-veenna-muted"
        >
          <span>Total</span>
          <span class="flex items-center gap-1.5 tabular-nums">
            <Skeleton class="h-3 w-8" :delay="skeletonDelay(8)" />
            words
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
