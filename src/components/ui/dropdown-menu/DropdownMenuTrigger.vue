<script setup lang="ts">
import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'
import { DropdownMenuTrigger, type DropdownMenuTriggerProps } from 'radix-vue'
import { cn } from '@/lib/utils'

const props = defineProps<DropdownMenuTriggerProps & { class?: HTMLAttributes['class'] }>()

/**
 * radix-vue asChild: if the trigger root has a `class`, it is merged onto the child and the
 * child's own `class` is removed. Our old `outline-none` on the root therefore stripped custom
 * button styles after open/close. With asChild, only forward an explicit `class` prop; put
 * `outline-none` on the child button when needed.
 */
const rootClass = computed(() => {
  if (props.asChild) {
    return props.class != null && props.class !== '' ? cn(props.class) : undefined
  }
  return cn('outline-none', props.class)
})

const passthroughProps = computed(() => {
  const { class: _c, ...rest } = props
  return rest
})
</script>

<template>
  <DropdownMenuTrigger v-bind="passthroughProps" :class="rootClass">
    <slot />
  </DropdownMenuTrigger>
</template>
