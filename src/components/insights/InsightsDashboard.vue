<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { isElectron } from '@/lib/platform/isElectron'
import { isCommunity } from '@/lib/platform/edition'
import { writeClipboardText } from '@/lib/clipboard/writeClipboardText'
import { PhShareNetwork } from '@phosphor-icons/vue'
import { useToast } from '@/components/ui/toast/use-toast'
import { useVoiceInsights } from '@/composables/useVoiceInsights'
import { useVoiceCapturesStore } from '@/stores/voiceCaptures'
import { SegmentControl } from '@/components/veenna'
import MetricCardsSkeleton from '@/components/skeleton/MetricCardsSkeleton.vue'
import InsightsActivityHeatmap from './InsightsActivityHeatmap.vue'
import InsightsAppUsageCard from './InsightsAppUsageCard.vue'
import InsightsTotalWordsCard from './InsightsTotalWordsCard.vue'
import InsightsTrendsChart from './InsightsTrendsChart.vue'
import InsightsVoicePanel from './InsightsVoicePanel.vue'
import InsightsWpmGauge from './InsightsWpmGauge.vue'
import { useErrorToast } from '@/composables/useMessageToast'

const props = withDefaults(
  defineProps<{
    embedded?: boolean
  }>(),
  { embedded: false },
)

const tab = ref<'usage' | 'voice'>('usage')
const showDesktopUsage = isElectron

const voiceTabOptions = [
  { id: 'usage', label: 'Your usage' },
  { id: 'voice', label: 'Your voice' },
] as const

const { toast } = useToast()
const voiceStore = useVoiceCapturesStore()
const {
  loading,
  error,
  summary,
  hasData,
  wpmRank,
  milestone,
  heatmapPoints,
  categoryUsage,
  trendSeries,
  totalApps,
  sourceBreakdown,
  avgDurationMs,
  load,
  refresh,
} = useVoiceInsights()

onMounted(() => {
  // Embedded under AnalyticsDashboard still needs local hydration / soft refresh.
  void load()
})

async function shareInsights() {
  const text = [
    `veenna Insights`,
    `${summary.value.totalWords.toLocaleString()} words dictated`,
    `${summary.value.averageWpm} WPM · ${summary.value.dayStreak}-day streak`,
  ].join('\n')

  try {
    if (navigator.share) {
      await navigator.share({ title: 'veenna Insights', text })
      return
    }
    const ok = await writeClipboardText(text)
    toast(
      ok
        ? { title: 'Insights copied' }
        : { title: 'Could not copy your insights', variant: 'destructive' },
    )
  } catch {
    /* user cancelled or clipboard blocked */
  }
}

useErrorToast(error)
</script>

<template>
  <section class="insights-dashboard space-y-5" aria-label="Usage insights">
    <div class="flex items-center gap-3">
      <SegmentControl
        v-model="tab"
        :options="[...voiceTabOptions]"
        variant="pill"
        aria-label="Insights section"
        class="min-w-0 flex-1"
      />

      <button
        type="button"
        class="insights-share shrink-0"
        aria-label="Share insights"
        title="Share insights"
        @click="shareInsights"
      >
        <svg class="insights-share__orbit" viewBox="0 0 64 64" aria-hidden="true">
          <defs>
            <path
              id="insightsShareCircle"
              d="M 32,32 m -24,0 a 24,24 0 1,1 48,0 a 24,24 0 1,1 -48,0"
            />
          </defs>
          <text class="insights-share__text">
            <textPath href="#insightsShareCircle" startOffset="0%">
              SHARE · SHARE · SHARE ·
            </textPath>
          </text>
        </svg>
        <PhShareNetwork class="relative z-[1] h-4 w-4" weight="bold" />
      </button>
    </div>

    <MetricCardsSkeleton
      v-if="loading"
      :count="3"
      grid-class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      tile-class="h-44"
    />

    <template v-else-if="tab === 'usage'">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <InsightsWpmGauge :wpm="summary.averageWpm" :rank-label="wpmRank" />
        <InsightsTotalWordsCard
          class="sm:col-span-2 xl:col-span-1"
          :total-words="summary.totalWords"
          :month-over-month-pct="summary.monthOverMonthPct"
          :milestone="milestone"
          :desktop-pct="summary.platformUsage.desktop"
          :mobile-pct="summary.platformUsage.mobile"
        />
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <InsightsAppUsageCard
          v-if="showDesktopUsage"
          :categories="categoryUsage"
          :total-apps="totalApps"
        />
        <InsightsActivityHeatmap
          :class="showDesktopUsage ? '' : 'lg:col-span-2'"
          :points="heatmapPoints"
          :day-streak="summary.dayStreak"
          :longest-streak="summary.longestStreak"
        />
      </div>

      <InsightsTrendsChart :series="trendSeries" />
    </template>

    <InsightsVoicePanel
      v-else
      :average-wpm="summary.averageWpm"
      :total-captures="summary.totalCaptures"
      :total-words="summary.totalWords"
      :series="trendSeries"
      :source-breakdown="sourceBreakdown"
      :avg-duration-ms="avgDurationMs"
    />

    <p v-if="!hasData && !loading" class="text-center text-caption text-veenna-muted">
      Stats fill in as you dictate - hold your hotkey on Dictation or Home to start your streak.
    </p>
  </section>
</template>

<style>
/* .insights-card moved to src/style.css - global, since Home renders
   InsightsActivityHeatmap/VoiceStatsCard without this component ever loading. */
.insights-share {
  position: relative;
  display: inline-flex;
  height: 2.75rem;
  width: 2.75rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: var(--veenna-row);
  color: var(--veenna-fg);
  transition:
    background-color 0.15s ease,
    transform 0.15s ease;
}

.insights-share:hover {
  background: var(--veenna-row-hover);
  transform: scale(1.04);
}

.insights-share__orbit {
  position: absolute;
  inset: -0.45rem;
  width: calc(100% + 0.9rem);
  height: calc(100% + 0.9rem);
  animation: insights-share-spin 14s linear infinite;
}

.insights-share__text {
  fill: var(--veenna-muted);
  font-size: 7px;
  font-weight: 600;
  letter-spacing: 0.22em;
}

@keyframes insights-share-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
