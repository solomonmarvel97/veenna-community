<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    animated?: boolean
    rounded?: 'sm' | 'md' | 'lg' | 'full' | 'none'
    /** Stagger shimmer start (ms). Prefer `skeletonDelay()` from `@/lib/skeleton`. */
    delay?: number
  }>(),
  { animated: true, rounded: 'md' },
)

const roundedClass = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-md',
  full: 'rounded-full',
  none: 'rounded-none',
}

const delayStyle = computed(() =>
  props.delay != null ? { '--skeleton-delay': `${props.delay}ms` } : undefined,
)
</script>

<template>
  <!-- A bone is decoration: the container around it says what is loading. -->
  <div
    aria-hidden="true"
    :class="[
      roundedClass[rounded],
      animated ? 'skeleton-shimmer' : 'skeleton-static',
      $attrs.class,
    ]"
    :style="delayStyle"
  />
</template>
