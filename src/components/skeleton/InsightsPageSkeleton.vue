<script setup lang="ts">
/** Insights before its code arrives: section tabs, time range, and the overview's tiles and charts. */
import Skeleton from '@/components/ui/Skeleton.vue'
import InsightsOverviewSkeleton from '@/components/skeleton/InsightsOverviewSkeleton.vue'
import PageSkeletonShell from '@/components/skeleton/PageSkeletonShell.vue'
import { veennaUi } from '@/lib/veennaUi'
</script>

<template>
  <PageSkeletonShell
    label="Loading insights"
    title="Insights"
    subtitle="Your dictation stats, worked out on this device."
    breadcrumb
    frosted
  >
    <div :class="['space-y-5', veennaUi.pageHeroGap, 'mx-1 sm:mx-2 lg:mx-4']">
      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton rounded="lg" class="h-8 w-72 max-w-full" :animated="false" />
        <Skeleton rounded="lg" class="h-8 w-full max-w-xs sm:w-32" :animated="false" />
      </div>
      <InsightsOverviewSkeleton />
    </div>
  </PageSkeletonShell>
</template>
