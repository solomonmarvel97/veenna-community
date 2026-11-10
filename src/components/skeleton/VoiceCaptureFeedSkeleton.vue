<script setup lang="ts">
/** Dictation captures: a day label, then cards with time, app, actions and the transcript. */
import Skeleton from '@/components/ui/Skeleton.vue'
import { skeletonDelay } from '@/lib/skeleton'

withDefaults(defineProps<{ count?: number }>(), { count: 4 })
</script>

<template>
  <div class="space-y-4" role="status" aria-busy="true" aria-label="Loading captures">
    <Skeleton class="h-3 w-14" />
    <div class="space-y-2">
      <div
        v-for="n in count"
        :key="n"
        class="overflow-hidden rounded-md border border-veenna-divider bg-card"
      >
        <div class="flex items-center justify-between gap-3 px-4 pt-2.5 pb-2">
          <div class="flex items-center gap-2">
            <Skeleton class="h-2.5 w-10" :animated="false" />
            <Skeleton class="h-2.5 w-16" :delay="skeletonDelay(n - 1)" />
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <Skeleton v-for="a in 3" :key="a" rounded="full" class="h-6 w-6" :animated="false" />
          </div>
        </div>
        <div class="h-px bg-veenna-divider" aria-hidden="true" />
        <div class="space-y-1.5 px-4 pb-2.5 pt-2">
          <Skeleton class="h-3 w-full" :delay="skeletonDelay(n - 1, 20)" />
          <Skeleton class="h-3 w-[86%]" :delay="skeletonDelay(n - 1, 40)" />
          <Skeleton v-if="n % 2 === 0" class="h-3 w-[62%]" :delay="skeletonDelay(n - 1, 60)" />
        </div>
      </div>
    </div>
  </div>
</template>
