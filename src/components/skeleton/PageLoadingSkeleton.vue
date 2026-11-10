<script setup lang="ts">
/**
 * The fallback for a page with no skeleton of its own: a page header and a
 * content block, in AppPageShell's shell, column and header boxes so the page
 * that arrives keeps its title where this one drew it. Most routes pass a
 * page-shaped placeholder instead (see routes.ts).
 */
import Skeleton from '@/components/ui/Skeleton.vue'
import { veennaUi } from '@/lib/veennaUi'
</script>

<template>
  <div
    :class="[veennaUi.pageShell, '!overflow-hidden']"
    role="status"
    aria-busy="true"
    aria-label="Loading page"
  >
    <div :class="[veennaUi.pageColumn, 'flex flex-col']">
      <header :class="veennaUi.pageHeader">
        <div class="min-w-0 flex-1">
          <Skeleton class="h-6 w-40 sm:h-7" />
          <Skeleton class="mt-1.5 h-3.5 w-56 max-w-[70%]" :delay="40" />
        </div>
      </header>
      <div :class="veennaUi.pageBody">
        <Skeleton rounded="lg" class="h-64 w-full" :delay="80" />
      </div>
    </div>
  </div>
</template>
