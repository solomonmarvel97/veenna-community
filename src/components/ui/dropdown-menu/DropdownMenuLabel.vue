<script setup lang="ts">
import { DropdownMenuLabel, type DropdownMenuLabelProps } from 'radix-vue'
import { cn } from '@/lib/utils'
import { veennaUi } from '@/lib/veennaUi'

const props = defineProps<DropdownMenuLabelProps & { class?: string; inset?: boolean }>()
</script>

<template>
  <DropdownMenuLabel v-bind="props" :class="cn(veennaUi.menuLabel, inset && 'pl-6', props.class)">
    <slot />
  </DropdownMenuLabel>
</template>
