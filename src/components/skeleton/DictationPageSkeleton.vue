<script setup lang="ts">
/** Placeholder for the Dictation page while its chunk loads: the real title and the history's shape. */
import Skeleton from '@/components/ui/Skeleton.vue'
import PageSkeletonShell from '@/components/skeleton/PageSkeletonShell.vue'
import VoiceCaptureFeedSkeleton from '@/components/skeleton/VoiceCaptureFeedSkeleton.vue'
import { veennaUi } from '@/lib/veennaUi'
</script>

<template>
  <PageSkeletonShell
    label="Loading dictation"
    title="Dictation"
    subtitle="Speak naturally and browse your capture history here."
    breadcrumb
    frosted
  >
    <div :class="['space-y-6', veennaUi.pageHeroGap]">
      <div class="space-y-3">
        <Skeleton class="h-3 w-28" :animated="false" />
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Skeleton rounded="lg" class="h-8 w-full sm:max-w-xs" :animated="false" />
          <Skeleton rounded="lg" class="h-8 w-full sm:w-32" :animated="false" />
        </div>
      </div>
      <VoiceCaptureFeedSkeleton />
    </div>
  </PageSkeletonShell>
</template>
