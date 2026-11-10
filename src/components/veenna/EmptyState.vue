<script setup lang="ts">
import { cn } from '@/lib/utils'
import { veennaUi } from '@/lib/veennaUi'

defineProps<{ class?: string }>()
</script>

<template>
  <div :class="cn(veennaUi.emptyState, $props.class)">
    <div v-if="$slots.default" class="text-body text-veenna-muted">
      <slot />
    </div>
    <div v-if="$slots.actions" class="mt-4 flex flex-wrap justify-center gap-3">
      <slot name="actions" />
    </div>
  </div>
</template>
