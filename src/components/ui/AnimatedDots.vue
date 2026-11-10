<script setup lang="ts">
/**
 * In-progress status label with animated trailing dots.
 * Pass the base label only - trailing … / ... are stripped automatically.
 */
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    label: string
    size?: 'xs' | 'sm' | 'md' | 'lg'
    class?: string
  }>(),
  { size: 'md' },
)

const labelText = computed(() =>
  String(props.label || '')
    .replace(/\u2026\s*$/u, '')
    .replace(/\.{2,}\s*$/u, '')
    .trim(),
)

const sizeClass = computed(() => {
  switch (props.size) {
    // 'sm' has always meant text-body (14px), which is the same as the default
    // and bigger than most rows that ask for it. Left alone rather than
    // redefined, since other callers are sized around it.
    case 'xs':
      return 'text-micro'
    case 'sm':
      return 'text-body'
    case 'lg':
      return 'text-title-sm'
    default:
      return 'text-body'
  }
})
</script>

<template>
  <span
    role="status"
    :aria-label="label"
    :class="cn('inline-flex items-baseline leading-none', sizeClass, props.class)"
  >
    <span class="inline-flex items-baseline"
      >{{ labelText
      }}<span class="running-status-dots" aria-hidden="true"><span /><span /><span /></span>
    </span>
  </span>
</template>
