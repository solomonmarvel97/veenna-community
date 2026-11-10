<script setup lang="ts">
import type { SelectItemProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { PhCheck } from '@phosphor-icons/vue'
import { SelectItem, SelectItemIndicator, SelectItemText, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'
import { veennaUi } from '@/lib/veennaUi'

const props = defineProps<SelectItemProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <SelectItem v-bind="forwardedProps" :class="cn(veennaUi.menuRow, 'w-full pr-6', props.class)">
    <slot name="leading" />

    <span class="absolute right-0 flex items-center justify-center">
      <SelectItemIndicator>
        <PhCheck weight="bold" />
      </SelectItemIndicator>
    </span>

    <SelectItemText>
      <slot />
    </SelectItemText>
    <!-- Not part of ItemText: excluded from the trigger’s selected label (Radix/reka-ui). -->
    <slot name="details" />
  </SelectItem>
</template>
