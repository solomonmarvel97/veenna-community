<script setup lang="ts">
import { veennaUi } from '@/lib/veennaUi'
import { cn } from '@/lib/utils'

withDefaults(
  defineProps<{
    tag?: string
    class?: string
  }>(),
  { tag: 'aside' },
)
</script>

<template>
  <component :is="tag" :class="cn(veennaUi.pane, $props.class)">
    <slot />
  </component>
</template>
