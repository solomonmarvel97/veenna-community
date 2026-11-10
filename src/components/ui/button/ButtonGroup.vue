<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

/**
 * Buttons joined into one control: 4px ends, square where they meet, a hairline between
 * them. Put Buttons straight inside (a main action, then a caret that opens a
 * menu of the rest, or a few related actions side by side).
 */
defineProps<{ class?: HTMLAttributes['class']; label?: string }>()
</script>

<template>
  <div
    role="group"
    :aria-label="label"
    :class="
      cn(
        'inline-flex items-stretch [&>*]:rounded-none [&>*:first-child]:rounded-l-[4px] [&>*:last-child]:rounded-r-[4px] [&>*:not(:first-child)]:ml-px',
        $props.class,
      )
    "
  >
    <slot />
  </div>
</template>
