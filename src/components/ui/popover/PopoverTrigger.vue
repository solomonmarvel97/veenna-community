<script setup lang="ts">
import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'
import type { PopoverTriggerProps } from 'reka-ui'
import { PopoverTrigger } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<PopoverTriggerProps & { class?: HTMLAttributes['class'] }>()

/**
 * reka-ui asChild: a class on the trigger root is merged onto the child and the
 * child's own class is dropped. That is why this chat-history picker looked
 * unstyled until hover - `bg-muted` lived on the Button and vanished. Same
 * fix as DropdownMenuTrigger: with asChild, only forward an explicit class.
 */
const rootClass = computed(() => {
  if (props.asChild) {
    return props.class != null && props.class !== '' ? cn(props.class) : undefined
  }
  return cn(props.class)
})

const passthroughProps = computed(() => {
  const { class: _c, ...rest } = props
  return rest
})
</script>

<template>
  <PopoverTrigger v-bind="passthroughProps" :class="rootClass">
    <slot />
  </PopoverTrigger>
</template>
