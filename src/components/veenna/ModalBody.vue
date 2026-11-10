<script setup lang="ts">
import { cn } from '@/lib/utils'
import { veennaUi } from '@/lib/veennaUi'

withDefaults(
  defineProps<{
    compact?: boolean
    class?: string
  }>(),
  { compact: false },
)
</script>

<template>
  <div
    :class="
      cn(
        'veenna-scroll-hidden min-h-0 flex-1 overflow-y-auto',
        compact ? ['space-y-3.5', veennaUi.overlayBodyCompact] : ['space-y-4', veennaUi.overlayBody],
        $props.class,
      )
    "
  >
    <slot />
  </div>
</template>
