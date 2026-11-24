<script setup lang="ts">
/**
 * Insights-style metric tiles in the standard card: a bordered header with the
 * label, the big number in the body, and a caption in the divided footer.
 * Optionally followed by chart cards (heatmap, trends).
 */
import Skeleton from '@/components/ui/Skeleton.vue'
import { skeletonDelay, skeletonWidth } from '@/lib/skeleton'
import { veennaUi } from '@/lib/veennaUi'

withDefaults(
  defineProps<{
    count?: number
    /** Grid for the tiles; matches the loaded panel's grid. */
    gridClass?: string
    /** Tile height, when the loaded tiles are taller than their text. */
    tileClass?: string
    /** Chart cards under the tiles (two-up from lg). */
    charts?: number
    label?: string
  }>(),
  {
    count: 4,
    gridClass: 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4',
    tileClass: '',
    charts: 0,
    label: 'Loading insights',
  },
)

const eyebrowWidths = ['w-20', 'w-16', 'w-24', 'w-14']
const valueWidths = ['w-24', 'w-16', 'w-20', 'w-14']
const captionWidths = ['w-28', 'w-20', 'w-32', 'w-24']
</script>

<template>
  <div class="space-y-4" role="status" aria-busy="true" :aria-label="label">
    <div :class="gridClass">
      <div v-for="i in count" :key="i" :class="[veennaUi.settingsCard, 'flex flex-col', tileClass]">
        <div :class="veennaUi.settingsGroupHeader">
          <Skeleton class="h-2.5" :class="skeletonWidth(eyebrowWidths, i - 1)" :animated="false" />
        </div>
        <div class="flex-1 px-4 py-4">
          <Skeleton
            class="h-8"
            :class="skeletonWidth(valueWidths, i - 1)"
            :delay="skeletonDelay(i - 1)"
          />
        </div>
        <div class="border-t border-veenna-divider px-4 py-3">
          <Skeleton
            class="h-3"
            :class="skeletonWidth(captionWidths, i - 1)"
            :delay="skeletonDelay(i - 1, 30)"
          />
        </div>
      </div>
    </div>

    <div v-if="charts" class="grid gap-4 lg:grid-cols-2">
      <div v-for="c in charts" :key="c" :class="[veennaUi.settingsCard, 'flex h-64 flex-col']">
        <div :class="veennaUi.settingsGroupHeader">
          <Skeleton class="h-2.5 w-28" :delay="skeletonDelay(count + c - 1)" />
        </div>
        <div class="flex min-h-0 flex-1 px-4 py-4">
          <Skeleton
            rounded="lg"
            class="min-h-0 w-full flex-1"
            :delay="skeletonDelay(count + c - 1, 40)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
