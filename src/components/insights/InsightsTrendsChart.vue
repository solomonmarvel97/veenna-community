<script setup lang="ts">
import { computed } from 'vue'
import { format, parseISO } from 'date-fns'
import { formatCompactCount } from '@/lib/insightsCopy'
import { veennaUi } from '@/lib/veennaUi'
import { isoDateKey } from '@/lib/dateUtils'
import ChartExpand from '@/components/shared/ChartExpand.vue'
import DayBarChart from '@/components/charts/DayBarChart.vue'

const props = defineProps<{
  series: Array<{ date: string; words: number; captures: number }>
}>()

const recent = computed(() =>
  [...props.series]
    .map((row) => ({ ...row, date: isoDateKey(row.date) || row.date }))
    .filter((row) => isoDateKey(row.date))
    .sort((a, b) => a.date.localeCompare(b.date)),
)

const totalRecent = computed(() => recent.value.reduce((sum, d) => d.words + sum, 0))
const hasTrend = computed(() => recent.value.some((d) => d.words > 0))
const days = computed(() => recent.value.map((d) => d.date))
const chartSeries = computed(() => [
  {
    key: 'words',
    label: 'Words',
    color: 'var(--veenna-accent)',
    values: recent.value.map((d) => d.words),
  },
])

function formatTipDay(date: string) {
  const key = isoDateKey(date)
  if (!key) return date
  try {
    return format(parseISO(key), 'EEE, MMM d')
  } catch {
    return key
  }
}

function captureCount(index: number | null) {
  return index == null ? 0 : (recent.value[index]?.captures ?? 0)
}
</script>

<template>
  <ChartExpand title="Words over time" :disabled="!hasTrend" class="h-full" v-slot="{ expanded }">
    <div :class="[veennaUi.laneCard, 'flex h-full flex-col', expanded && 'flex-1']">
      <!-- Right padding leaves room for the expand button that appears on hover. -->
      <div :class="[veennaUi.laneHeader, 'pr-12']">
        <h3 :class="veennaUi.laneLabel">Words over time</h3>
        <p class="text-caption text-veenna-muted">Last {{ recent.length || 30 }} days</p>
      </div>

      <div
        v-if="hasTrend"
        class="flex flex-1 flex-col px-3 pb-3 pt-4"
        :class="expanded ? 'min-h-[26rem]' : 'min-h-[13rem]'"
      >
        <DayBarChart
          class="flex-1"
          :days="days"
          :series="chartSeries"
          :format="formatCompactCount"
          integers
          last-label="Today"
        >
          <template #tooltip="{ index, day }">
            <p class="mb-1.5 font-semibold text-foreground">{{ formatTipDay(day) }}</p>
            <p class="flex items-center justify-between gap-4 tabular-nums">
              <span class="text-muted-foreground">Words</span>
              {{ (recent[index ?? 0]?.words ?? 0).toLocaleString() }}
            </p>
            <p v-if="captureCount(index)" class="mt-0.5 text-muted-foreground">
              {{ captureCount(index) }} capture{{ captureCount(index) === 1 ? '' : 's' }}
            </p>
          </template>
        </DayBarChart>
      </div>

      <div
        v-else
        class="m-4 flex min-h-[13rem] flex-1 items-center justify-center rounded-sm bg-veenna-row text-caption text-veenna-muted"
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
