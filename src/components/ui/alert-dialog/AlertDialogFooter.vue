<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <div
    :class="
      cn(
        '-mx-4 -mb-4 mt-3 flex h-11 flex-row items-center justify-end gap-2 border-t border-veenna-divider px-4 py-0 [&>*]:flex-1 sm:[&>*]:flex-none',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
