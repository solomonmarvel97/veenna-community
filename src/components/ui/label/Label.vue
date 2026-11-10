<script setup lang="ts">
import type { LabelProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { Label } from 'reka-ui'
import { cn } from '@/lib/utils'
import RequiredMark from './RequiredMark.vue'
import OptionalMark from './OptionalMark.vue'

const props = defineProps<
  LabelProps & {
    class?: HTMLAttributes['class']
    required?: boolean
    optional?: boolean
  }
>()

const delegatedProps = reactiveOmit(props, 'class', 'required', 'optional')
</script>

<template>
  <Label
    v-bind="delegatedProps"
    :class="
      cn(
        'text-body font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        (props.required || props.optional) && 'inline-flex items-center gap-2',
        props.class,
      )
    "
  >
    <slot />
    <RequiredMark v-if="props.required" />
    <OptionalMark v-if="props.optional" />
  </Label>
</template>
