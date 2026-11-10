<script setup lang="ts">
import { DropdownMenuItem, type DropdownMenuItemProps } from 'radix-vue'
import { cn } from '@/lib/utils'
import { veennaUi } from '@/lib/veennaUi'

const props = defineProps<
  DropdownMenuItemProps & { class?: string; inset?: boolean; destructive?: boolean }
>()
</script>

<template>
  <DropdownMenuItem
    v-bind="props"
    :class="cn(veennaUi.menuRow, destructive && veennaUi.menuDestructive, inset && 'pl-6', props.class)"
  >
    <slot />
    <span v-if="$slots.hint" class="ml-auto shrink-0 pl-3 text-veenna-muted">
      <slot name="hint" />
    </span>
  </DropdownMenuItem>
</template>
