<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useVeennaAnalyticsStore } from '@/stores/veennaAnalytics'
import { SegmentControl } from '@/components/veenna'
import InsightsOverviewSkeleton from '@/components/skeleton/InsightsOverviewSkeleton.vue'
import { InsightsDashboard } from '@/components/insights'
import AnalyticsOverviewPanel from './AnalyticsOverviewPanel.vue'
import { useErrorToast } from '@/composables/useMessageToast'

type AnalyticsSection = 'overview' | 'voice'

const store = useVeennaAnalyticsStore()
const section = ref<AnalyticsSection>('overview')

const sectionOptions: Array<{ id: AnalyticsSection; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'voice', label: 'Voice' },
]

const payload = computed(() => store.data)
/** On screen is another range's numbers while the chosen one loads. */
const staleRange = computed(
  () =>
    store.refreshing && Boolean(payload.value) && payload.value?.periodDays !== store.periodDays,
)

onMounted(() => {
  void store.load(true)
})

useErrorToast(() => store.error)
</script>

<template>
  <section class="analytics-dashboard space-y-5" aria-label="Insights">
    <div class="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      <SegmentControl
        v-model="section"
        :options="sectionOptions"
        variant="pill"
        aria-label="Insights section"
      />
      <div v-if="$slots.toolbar" class="sm:shrink-0">
        <slot name="toolbar" />
      </div>
    </div>

    <!-- The overview's own layout: four tiles over the heatmap and trends cards. -->
    <InsightsOverviewSkeleton v-if="store.loading && !payload" />

    <div
      v-else-if="payload"
      :class="[
        'transition-opacity duration-200',
        staleRange ? 'pointer-events-none opacity-50' : 'opacity-100',
      ]"
      :aria-busy="store.refreshing"
    >
      <AnalyticsOverviewPanel v-if="section === 'overview'" :data="payload" />
      <InsightsDashboard v-else embedded />
    </div>

    <p
      v-else-if="!store.loading"
      class="rounded-md border border-veenna-border bg-veenna-row/40 px-4 py-6 text-center text-body text-veenna-muted"
    >
      No insights yet. Dictate something to start filling this page.
    </p>
  </section>
</template>
