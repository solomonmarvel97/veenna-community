<script setup lang="ts">
import { cn } from '@/lib/utils'
import { veennaUi } from '@/lib/veennaUi'

const props = withDefaults(
  defineProps<{
    variant?: 'error' | 'success'
    class?: string
  }>(),
  { variant: 'error' },
)
</script>

<template>
  <p
    :class="cn(props.variant === 'success' ? veennaUi.alertSuccess : veennaUi.alertError, props.class)"
    role="alert"
  >
    <slot />
  </p>
</template>
