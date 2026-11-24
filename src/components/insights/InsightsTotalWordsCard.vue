<script setup lang="ts">
import { isCommunity } from '@/lib/platform/edition'
import { computed } from 'vue'
import { formatCompactCount, formatGrowthBadge } from '@/lib/insightsCopy'
import { veennaUi } from '@/lib/veennaUi'

const props = defineProps<{
  totalWords: number
  monthOverMonthPct: number
  milestone: string
  desktopPct: number
  mobilePct: number
}>()

const growth = computed(() => formatGrowthBadge(props.monthOverMonthPct))

const desktopWidth = computed(() => {
  if (props.totalWords <= 0) return 50
  return Math.max(8, Math.min(92, props.desktopPct || 100))
})

const mobileWidth = computed(() => Math.max(0, 100 - desktopWidth.value))
</script>

<template>
  <div :class="[veennaUi.settingsCard, 'flex h-full flex-col']">
    <div :class="veennaUi.settingsGroupHeader">
      <h3 :class="veennaUi.settingsGroupLabel">Words dictated</h3>
      <span
        v-if="growth"
        class="shrink-0 rounded-full bg-veenna-accent-soft px-2 py-0.5 text-micro font-medium text-veenna-accent"
      >
        {{ growth }}
      </span>
    </div>

    <div class="flex flex-1 flex-col px-4 py-4">
      <p class="text-stat font-semibold tabular-nums leading-none text-veenna-fg">
        {{ formatCompactCount(totalWords) }}
      </p>
      <p class="mt-3 text-body leading-relaxed text-veenna-muted">{{ milestone }}</p>

      <div class="mt-auto pt-6">
        <div class="flex h-3 w-full overflow-hidden rounded-full bg-veenna-row">
          <div
            class="h-full rounded-l-full bg-veenna-accent transition-[width] duration-700 ease-out"
            :style="{ width: `${desktopWidth}%` }"
          />
          <div
            class="h-full rounded-r-full transition-[width] duration-700 ease-out"
            :style="{
              width: `${mobileWidth}%`,
              background: 'color-mix(in srgb, var(--veenna-accent) 35%, transparent)',
            }"
          />
        </div>
      </div>
    </div>

    <div
      class="flex items-center justify-between border-t border-veenna-divider px-4 py-2.5 text-caption text-veenna-muted"
    >
      <span>Desktop</span>
      <span v-if="!isCommunity">Mobile</span>
    </div>
  </div>
</template>
