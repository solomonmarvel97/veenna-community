<script setup lang="ts">
import type { InputHTMLAttributes } from 'vue'
import { useVModel } from '@vueuse/core'
import { cn } from '@/lib/utils'
import { veennaUi } from '@/lib/veennaUi'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  defaultValue?: string | number
  modelValue?: string | number
  class?: InputHTMLAttributes['class']
  type?: InputHTMLAttributes['type']
}>()

const emits = defineEmits<{
  (e: 'update:modelValue', payload: string | number): void
}>()

const modelValue = useVModel(props, 'modelValue', emits, {
  passive: true,
  defaultValue: props.defaultValue,
})
</script>

<template>
  <input
    v-bind="$attrs"
    v-model="modelValue"
    :type="type ?? 'text'"
    :class="
      cn(
        veennaUi.field,
        'h-8 py-1.5 file:border-0 file:bg-transparent file:text-body file:font-normal file:text-veenna-fg',
        'veenna-field',
        props.class,
      )
    "
  />
</template>
