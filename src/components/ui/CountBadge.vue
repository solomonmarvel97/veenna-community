<script setup lang="ts">
import { cn } from '@/lib/utils'

/**
 * A count as a perfect circle. Past 99 it no longer fits one, so it drops the
 * circle and shows the number plain, in the circle's colour.
 */
withDefaults(
  defineProps<{
    count: number
    tone?: 'accent' | 'emerald'
    /** Diameter in px; plain text uses the same box so rows do not shift. */
    size?: number
  }>(),
  { tone: 'accent', size: 18 },
)
</script>

<template>
  <span
    v-if="count > 0"
    :class="
      cn(
        'inline-flex shrink-0 items-center justify-center font-semibold leading-none tabular-nums',
        count > 99
          ? ['text-micro', tone === 'emerald' ? 'text-emerald-500' : 'text-veenna-accent']
          : [
              'rounded-full text-micro',
              tone === 'emerald'
                ? 'bg-emerald-500 text-white'
                : 'bg-veenna-accent text-veenna-accent-fg',
            ],
      )
    "
    :style="
      count > 99
        ? { minWidth: `${size}px`, height: `${size}px` }
        : { width: `${size}px`, height: `${size}px` }
    "
  >
    {{ count }}
  </span>
</template>
