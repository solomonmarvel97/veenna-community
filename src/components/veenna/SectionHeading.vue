<script setup lang="ts">
import { veennaUi } from '@/lib/veennaUi'
import { cn } from '@/lib/utils'

defineProps<{
  class?: string
}>()
</script>

<template>
  <h3 :class="cn(veennaUi.sectionHeading, $props.class)">
    <slot />
  </h3>
</template>
