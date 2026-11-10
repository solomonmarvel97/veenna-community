<script setup lang="ts">
import { DropdownMenuSeparator, type DropdownMenuSeparatorProps } from 'radix-vue'
import { cn } from '@/lib/utils'
import { veennaUi } from '@/lib/veennaUi'

const props = defineProps<DropdownMenuSeparatorProps & { class?: string }>()
</script>

<template>
  <DropdownMenuSeparator v-bind="props" :class="cn(veennaUi.menuSeparator, props.class)" />
</template>
