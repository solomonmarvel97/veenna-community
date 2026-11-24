<script setup lang="ts">
import { computed } from 'vue'
import { formatCompactCount, formatGrowthBadge, wordsMilestone, wpmPaceLabel } from '@/lib/insightsCopy'
import { fillDailySeries, validHeatmapPoints } from '@/lib/insightsSeries'
import type { VeennaAnalyticsPayload } from '@/types/insights'
import InsightsActivityHeatmap from '@/components/insights/InsightsActivityHeatmap.vue'
import InsightsTrendsChart from '@/components/insights/InsightsTrendsChart.vue'
import AnalyticsStatCard from './AnalyticsStatCard.vue'

const props = defineProps<{
  data: VeennaAnalyticsPayload
}>()

const voice = computed(() => props.data.voice)
const wpmRank = computed(() => wpmPaceLabel(voice.value.averageWpm))
const milestone = computed(() => wordsMilestone(voice.value.totalWords))
const growth = computed(() => formatGrowthBadge(voice.value.monthOverMonthPct))

const trendSeries = computed(() =>
  fillDailySeries(
    props.data.dailyTrend,
    props.data.periodDays,
  ),
)

const heatmapPoints = computed(() => {
  const fromVoice = validHeatmapPoints(voice.value.heatmap)
  if (fromVoice.length) return fromVoice
  return props.data.dailyTrend.map((row) => ({ date: row.date, words: row.words }))
})
</script>

<template>
  <div class="space-y-4">
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <AnalyticsStatCard
        label="Words dictated"
        :value="formatCompactCount(voice.totalWords)"
        :note="growth || milestone"
        :note-accent="Boolean(growth)"
      />
      <AnalyticsStatCard
        label="Speaking pace"
        :value="voice.averageWpm ? String(voice.averageWpm) : '-'"
        :note="wpmRank"
      />
      <AnalyticsStatCard
        label="Dictations"
        :value="formatCompactCount(voice.totalCaptures)"
        note="Saved on this device"
      />
      <AnalyticsStatCard
        label="Day streak"
        :value="String(voice.dayStreak)"
        :note="`Longest ${voice.longestStreak} days`"
      />
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <InsightsActivityHeatmap
        :points="heatmapPoints"
        :day-streak="voice.dayStreak"
        :longest-streak="voice.longestStreak"
      />
      <InsightsTrendsChart :series="trendSeries" />
    </div>
  </div>
</template>
