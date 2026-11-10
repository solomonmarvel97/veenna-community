<script setup lang="ts">
import { veennaUi } from '@/lib/veennaUi'
import { cn } from '@/lib/utils'
import IconButton from './IconButton.vue'

defineProps<{
  title: string
  backLabel?: string
  class?: string
}>()

const emit = defineEmits<{ back: [] }>()
</script>

<template>
  <header :class="cn(veennaUi.paneHeader, $props.class)">
    <IconButton size="sm" :label="backLabel ?? 'Back'" @click="emit('back')">
      <slot name="back-icon" />
    </IconButton>
    <h1 class="text-title-sm font-semibold">{{ title }}</h1>
    <div v-if="$slots.trailing" class="ml-auto">
      <slot name="trailing" />
    </div>
  </header>
</template>
