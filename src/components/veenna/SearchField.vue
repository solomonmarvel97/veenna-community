<script setup lang="ts">
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    /** `row` matches the Notes list search: filled surface instead of a hairline border. */
    variant?: 'default' | 'row'
    class?: string
    inputClass?: string
  }>(),
  { placeholder: 'Search…', variant: 'default' },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div
    :class="
      cn(
        'veenna-field-wrap relative flex items-center rounded-md border',
        variant === 'row'
          ? 'border-transparent bg-veenna-row transition-colors focus-within:bg-veenna-row-hover'
          : 'border-veenna-search-border bg-veenna-search-bg shadow-veenna-search',
        $props.class,
      )
    "
  >
    <span
      v-if="$slots.icon"
      :class="
        cn(
          'pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2',
          variant === 'row' ? 'text-veenna-muted' : 'text-veenna-icon-muted',
        )
      "
    >
      <slot name="icon" />
    </span>
    <Input
      :model-value="modelValue"
      type="search"
      :placeholder="placeholder"
      :class="
        cn(
          'veenna-field veenna-field-ghost h-8 min-w-0 border-0 bg-transparent pl-8 shadow-none focus-visible:bg-transparent',
          inputClass,
        )
      "
      @update:model-value="emit('update:modelValue', $event as string)"
    />
  </div>
</template>
