<script setup lang="ts">
import { computed } from 'vue'
import AppPageShell from '@/components/app/AppPageShell.vue'
import { AnalyticsDashboard, ANALYTICS_PERIOD_OPTIONS } from '@/components/analytics'
import { veennaUi } from '@/lib/veennaUi'
import { isCommunity } from '@/lib/platform/edition'
import { useVeennaAnalyticsStore } from '@/stores/veennaAnalytics'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const analyticsStore = useVeennaAnalyticsStore()

const analyticsPeriod = computed({
  get: () => String(analyticsStore.periodDays),
  set: (value: string) => {
    void analyticsStore.load(false, Number(value))
  },
})
</script>

<template>
  <AppPageShell
    title="Insights"
    :subtitle="
      isCommunity
        ? 'Your dictation stats, from this device.'
        : 'Your dictation stats, worked out on this device.'
    "
    hide-top-search
    reveal
    frosted
  >
    <div :class="['space-y-6', veennaUi.pageHeroGap]" data-section-reveal>
      <AnalyticsDashboard>
        <template #toolbar>
          <div class="w-full max-w-xs sm:w-32">
            <Select v-model="analyticsPeriod">
              <SelectTrigger
                aria-label="Insights time range"
                :loading="analyticsStore.loading || analyticsStore.refreshing"
              >
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in ANALYTICS_PERIOD_OPTIONS"
                  :key="option.id"
                  :value="option.id"
                >
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </template>
      </AnalyticsDashboard>
    </div>
  </AppPageShell>
</template>
