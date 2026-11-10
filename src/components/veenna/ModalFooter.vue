<script setup lang="ts">
import { cn } from '@/lib/utils'

withDefaults(
  defineProps<{
    variant?: 'actions' | 'single' | 'meta'
    class?: string
  }>(),
  { variant: 'actions' },
)
</script>

<template>
  <footer
    :class="
      cn(
        'min-h-11 shrink-0 border-t border-veenna-divider px-4 py-2',
        variant === 'actions' && 'flex w-full items-center justify-end gap-2',
        variant === 'meta' &&
          'flex flex-col justify-center gap-3 sm:flex-row sm:items-center sm:justify-between',
        variant === 'single' && 'flex flex-col justify-center',
        $props.class,
      )
    "
  >
    <slot />
  </footer>
</template>
