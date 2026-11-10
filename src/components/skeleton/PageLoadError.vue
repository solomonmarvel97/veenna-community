<script setup lang="ts">
import { veennaUi } from '@/lib/veennaUi'

function reload() {
  window.location.reload()
}
</script>

<template>
  <!-- A lazy page whose code never arrived: say so instead of loading forever. -->
  <div
    :class="[
      veennaUi.pageColumn,
      'flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-16',
    ]"
    role="alert"
  >
    <p class="text-body font-medium text-veenna-fg">This page couldn’t open</p>
    <p class="max-w-sm text-center text-caption text-veenna-muted">
      Its code didn’t load. Reloading the app usually fixes it.
    </p>
    <button
      type="button"
      class="inline-flex h-7 items-center rounded-md border border-veenna-divider bg-veenna-bg px-3 text-caption font-medium text-veenna-fg hover:bg-veenna-row"
      @click="reload"
    >
      Reload
    </button>
  </div>
</template>
