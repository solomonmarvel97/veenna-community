<script setup lang="ts">
/**
 * A settings page before its code arrives: an intro line and two cards of
 * rows, in the same boxes the real pages use, so nothing jumps when it lands.
 */
import Skeleton from '@/components/ui/Skeleton.vue'
import { veennaUi } from '@/lib/veennaUi'
</script>

<template>
  <div class="space-y-3" aria-busy="true" aria-label="Loading settings page">
    <Skeleton class="h-3 w-80 max-w-full" rounded="md" />
    <section v-for="card in 2" :key="card" :class="veennaUi.settingsCard">
      <div :class="[veennaUi.settingsGroupHeader, 'h-10 py-0']">
        <Skeleton class="h-3 w-24" rounded="md" :delay="card * 60" />
      </div>
      <div :class="veennaUi.settingsRows">
        <div v-for="row in 3" :key="row" :class="veennaUi.settingsRow">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1 space-y-1.5">
              <Skeleton class="h-3.5 w-36 max-w-[70%]" rounded="md" :delay="card * 60 + row * 30" />
              <Skeleton
                class="h-3 w-64 max-w-full"
                rounded="md"
                :delay="card * 60 + row * 30 + 15"
              />
            </div>
            <Skeleton class="h-8 w-20 shrink-0" rounded="md" :delay="card * 60 + row * 30" />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
