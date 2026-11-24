<script setup lang="ts">
import Skeleton from '@/components/ui/Skeleton.vue'

const skeletonRows = [
  { depth: 0, nameWidth: 'w-36', barLeft: '2%', barWidth: '92%', hasToggle: true },
  { depth: 1, nameWidth: 'w-28', barLeft: '4%', barWidth: '36%', hasToggle: true },
  { depth: 2, nameWidth: 'w-40', barLeft: '6%', barWidth: '16%', hasToggle: false },
  { depth: 2, nameWidth: 'w-32', barLeft: '24%', barWidth: '14%', hasToggle: false },
  { depth: 1, nameWidth: 'w-24', barLeft: '42%', barWidth: '48%', hasToggle: true },
  { depth: 2, nameWidth: 'w-36', barLeft: '46%', barWidth: '20%', hasToggle: false },
  { depth: 2, nameWidth: 'w-28', barLeft: '68%', barWidth: '20%', hasToggle: false },
  { depth: 0, nameWidth: 'w-32', barLeft: '90%', barWidth: '8%', hasToggle: false },
]
</script>

<template>
  <div
    class="flex flex-col divide-y divide-veenna-divider overflow-hidden rounded-sm border border-veenna-divider text-caption"
    aria-busy="true"
    aria-label="Loading trace spans"
  >
    <div v-for="(row, i) in skeletonRows" :key="i" class="flex items-center gap-2 px-2.5 py-1.5">
      <!-- Name column skeleton -->
      <div
        class="flex min-w-0 shrink-0 items-center gap-1"
        :style="{ width: '17rem', paddingLeft: `${row.depth * 0.75}rem` }"
      >
        <Skeleton v-if="row.hasToggle" class="h-3 w-3 shrink-0" rounded="sm" :delay="i * 40" />
        <span v-else class="h-3 w-3 shrink-0" />

        <Skeleton class="h-2 w-2 shrink-0" rounded="sm" :delay="i * 40 + 20" />
        <Skeleton class="h-3.5" :class="row.nameWidth" :delay="i * 40 + 40" />
      </div>

      <!-- Bar track skeleton -->
      <div class="relative h-4 min-w-0 flex-1 overflow-hidden rounded-sm bg-veenna-row/30">
        <Skeleton
          class="absolute top-0 h-full rounded-sm"
          :style="{ left: row.barLeft, width: row.barWidth }"
          :delay="i * 40 + 60"
        />
      </div>

      <!-- Duration skeleton -->
      <div class="flex w-16 shrink-0 justify-end">
        <Skeleton class="h-3 w-10" :delay="i * 40 + 80" />
      </div>
    </div>
  </div>
</template>
