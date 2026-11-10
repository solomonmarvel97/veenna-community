<script setup lang="ts">
import type { SelectTriggerProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { PhCaretDown, PhSpinner } from '@phosphor-icons/vue'
import { SelectIcon, SelectTrigger, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'
import { veennaUi } from '@/lib/veennaUi'

const props = defineProps<
  SelectTriggerProps & { class?: HTMLAttributes['class']; loading?: boolean }
>()

const delegatedProps = reactiveOmit(props, 'class', 'loading')

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <SelectTrigger
    v-bind="forwardedProps"
    :class="
      cn(
        veennaUi.controlTrigger,
        'grid h-8 py-1.5 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 whitespace-nowrap shadow-none data-[placeholder]:text-veenna-muted text-start veenna-field [&>span:first-child]:col-start-1 [&>span:first-child]:min-w-0 [&>span:first-child]:truncate',
        props.class,
      )
    "
  >
    <slot />
    <SelectIcon as-child class="col-start-2 shrink-0 justify-self-end">
      <PhSpinner v-if="loading" class="w-4 h-4 animate-spin opacity-70 shrink-0 text-foreground" />
      <PhCaretDown v-else class="w-4 h-4 opacity-50 shrink-0" />
    </SelectIcon>
  </SelectTrigger>
</template>
