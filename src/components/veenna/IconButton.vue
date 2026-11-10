<script setup lang="ts">
import { PhX, PhSpinner } from '@phosphor-icons/vue'
import { cn } from '@/lib/utils'
import { veennaUi } from '@/lib/veennaUi'

defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    size?: 'sm' | 'md'
    label: string
    disabled?: boolean
    loading?: boolean
    class?: string
  }>(),
  { size: 'sm', disabled: false, loading: false },
)

defineEmits<{ click: [event: MouseEvent] }>()
</script>

<template>
  <button
    type="button"
    :class="cn(size === 'sm' ? veennaUi.iconBtnSm : veennaUi.iconBtnMd, $props.class)"
    :aria-label="label"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    v-bind="$attrs"
    @click="$emit('click', $event)"
  >
    <PhSpinner
      v-if="loading"
      :class="size === 'sm' ? veennaUi.spinnerIconSm : veennaUi.spinnerIcon"
      aria-hidden="true"
    />
    <slot v-else>
      <PhX class="h-4 w-4" weight="bold" />
    </slot>
  </button>
</template>
