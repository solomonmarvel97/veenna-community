<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { DropdownMenuSubTrigger, type DropdownMenuSubTriggerProps } from 'radix-vue'
import { PhCaretRight } from '@phosphor-icons/vue'
import { cn } from '@/lib/utils'
import { veennaUi } from '@/lib/veennaUi'

const props = defineProps<
  DropdownMenuSubTriggerProps & { class?: HTMLAttributes['class']; inset?: boolean }
>()

const delegatedProps = reactiveOmit(props, 'class', 'inset')
</script>

<template>
  <DropdownMenuSubTrigger
    v-bind="delegatedProps"
    :class="cn(veennaUi.menuRow, 'w-full cursor-default', inset && 'pl-6', props.class)"
  >
    <slot />
    <PhCaretRight class="ml-auto text-muted-foreground" weight="bold" aria-hidden="true" />
  </DropdownMenuSubTrigger>
</template>
