<script setup lang="ts">
import { computed } from 'vue'
import { format, parseISO } from 'date-fns'
import { formatCompactCount } from '@/lib/insightsCopy'
import { isoDateKey } from '@/lib/dateUtils'
import type { VoiceInsightsSourceBreakdown } from '@/types/insights'
import { veennaUi } from '@/lib/veennaUi'
import AnalyticsStatCard from '@/components/analytics/AnalyticsStatCard.vue'

const props = defineProps<{
  averageWpm: number
  totalCaptures: number
  totalWords: number
  series: Array<{ date: string; words: number; captures: number }>
  sourceBreakdown: VoiceInsightsSourceBreakdown
  avgDurationMs: number
}>()

const avgWordsPerCapture = computed(() => {
  if (!props.totalCaptures) return 0
  return Math.round(props.totalWords / props.totalCaptures)
})

const avgDurationSec = computed(() =>
  props.avgDurationMs ? Math.round(props.avgDurationMs / 1000) : 0,
)

const sourceBreakdownRows = computed(() => {
  const counts = props.sourceBreakdown
  const counted = counts.dictation + counts.hotkey + counts.manual
  const total = Math.max(1, counted || props.totalCaptures)
  return [
    {
      id: 'dictation',
      label: 'Hold-to-talk',
      count: counts.dictation,
      pct: Math.round((counts.dictation / total) * 100),
    },
    {
      id: 'hotkey',
      label: 'Hands-free',
      count: counts.hotkey,
      pct: Math.round((counts.hotkey / total) * 100),
    },
    {
      id: 'manual',
      label: 'Manual',
      count: counts.manual,
      pct: Math.round((counts.manual / total) * 100),
    },
  ].filter((row) => row.count > 0 || props.totalCaptures === 0)
})

const recentCaptures = computed(() =>
  [...props.series]
    .filter((d) => d.captures > 0 && isoDateKey(d.date))
    .slice(-14)
    .reverse(),
)

const peakDay = computed(() => {
  const ranked = props.series.filter((row) => row.words > 0 && isoDateKey(row.date))
  if (!ranked.length) return null
  return [...ranked].sort((a, b) => b.words - a.words)[0]
})

function formatDay(date: string, pattern: string) {
  const key = isoDateKey(date)
  if (!key) return ''
  try {
    return format(parseISO(key), pattern)
  } catch {
    return key
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="grid gap-4 sm:grid-cols-3">
      <AnalyticsStatCard
        label="Avg session"
        :value="avgWordsPerCapture ? String(avgWordsPerCapture) : '-'"
        note="Words per capture"
      />
      <AnalyticsStatCard
        label="Speaking pace"
        :value="averageWpm ? String(averageWpm) : '-'"
        note="Words per minute"
      />
      <AnalyticsStatCard
        label="Avg duration"
        :value="avgDurationSec ? `${avgDurationSec}s` : '-'"
        note="Per timed capture"
      />
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <div :class="[veennaUi.settingsCard, 'flex flex-col']">
        <div :class="veennaUi.settingsGroupHeader">
          <h3 :class="veennaUi.settingsGroupLabel">How you dictate</h3>
          <span class="text-caption tabular-nums text-veenna-muted">
            {{ totalCaptures.toLocaleString() }} captures
          </span>
        </div>

        <ul v-if="totalCaptures > 0" class="flex-1 space-y-4 px-4 py-4">
          <li v-for="row in sourceBreakdownRows" :key="row.id">
            <div class="mb-1.5 flex items-center justify-between text-body">
              <span class="text-veenna-fg">{{ row.label }}</span>
              <span class="tabular-nums text-veenna-muted">{{ row.pct }}%</span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-veenna-row">
              <div
                class="h-full rounded-full bg-veenna-accent transition-[width] duration-700"
                :style="{ width: `${row.pct}%` }"
              />
            </div>
          </li>
        </ul>
        <p v-else class="flex-1 px-4 py-4 text-body text-veenna-muted">
          Your input-mode breakdown appears after your first capture.
        </p>
        <p class="border-t border-veenna-divider px-4 py-2.5 text-caption text-veenna-muted">
          Share of captures by input mode
        </p>
      </div>

      <div :class="[veennaUi.settingsCard, 'flex flex-col']">
        <div :class="veennaUi.settingsGroupHeader">
          <h3 :class="veennaUi.settingsGroupLabel">Peak day</h3>
          <span
            v-if="peakDay && peakDay.words > 0"
            class="text-caption tabular-nums text-veenna-muted"
          >
            <span class="font-semibold text-veenna-fg">{{ formatCompactCount(peakDay.words) }}</span>
            words
          </span>
        </div>

        <div class="flex-1 px-4 py-4">
          <p v-if="peakDay && peakDay.words > 0" class="text-body text-veenna-fg">
            {{ formatDay(peakDay.date, 'EEEE, MMMM d') }}
            <span class="text-veenna-muted">
              · {{ peakDay.captures }} capture{{ peakDay.captures === 1 ? '' : 's' }}
            </span>
          </p>
          <p v-else class="text-body text-veenna-muted">
            Keep dictating - your peak day will show up here.
          </p>

          <div v-if="recentCaptures.length" class="mt-6 space-y-2">
            <p class="text-micro font-semibold uppercase tracking-overline text-veenna-muted">
              Recent active days
            </p>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="day in recentCaptures.slice(0, 8)"
                :key="day.date"
                class="rounded-md bg-veenna-row px-2 py-1 text-label tabular-nums text-veenna-fg"
              >
                {{ formatDay(day.date, 'MMM d') }}
                · {{ day.words }}
              </span>
            </div>
          </div>
        </div>

        <p class="border-t border-veenna-divider px-4 py-2.5 text-caption text-veenna-muted">
          Your strongest dictation day so far
        </p>
      </div>
    </div>
  </div>
</template>
