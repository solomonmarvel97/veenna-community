<script setup lang="ts">
/**
 * Settings before its code arrives: the title, the menu and a page, drawn in
 * the same boxes the real page uses so opening it never flashes an empty pane.
 */
import Skeleton from '@/components/ui/Skeleton.vue'
import SettingsPanelSkeleton from '@/components/settings/SettingsPanelSkeleton.vue'
import { veennaUi } from '@/lib/veennaUi'
</script>

<template>
  <div :class="veennaUi.pageShell" role="status" aria-label="Loading settings" aria-busy="true">
    <div class="mx-auto flex w-full max-w-5xl flex-col px-3 sm:px-4">
      <div :class="veennaUi.pageHeader">
        <Skeleton class="h-8 w-40" rounded="md" />
      </div>
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <!-- The menu, laid out like SettingsSidebarNav. -->
        <div class="hidden w-[13.5rem] shrink-0 flex-col p-2 lg:flex">
          <Skeleton class="mx-1.5 mb-2.5 h-2.5 w-16" rounded="md" />
          <div class="space-y-0.5">
            <div v-for="n in 12" :key="n" class="flex h-8 items-center gap-2.5 px-1.5">
              <Skeleton class="h-5 w-5 shrink-0" rounded="md" :delay="n * 25" />
              <Skeleton class="h-3 w-24" rounded="md" :delay="n * 25 + 10" />
            </div>
          </div>
        </div>
        <div class="min-w-0 max-w-4xl flex-1">
          <SettingsPanelSkeleton />
        </div>
      </div>
    </div>
  </div>
</template>
