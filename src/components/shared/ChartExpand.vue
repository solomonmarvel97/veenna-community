<script setup lang="ts">
/**
 * Wraps a chart so hovering it shows an expand button, which opens the same
 * chart in a wide modal (80% of the window). The slot is rendered a second time
 * inside the modal, with `expanded` true so a chart can adapt if it needs to.
 */
import { ref } from 'vue'
import { PhArrowsOut } from '@phosphor-icons/vue'
import { IconButton, ModalBody, ModalHeader, VeennaModal } from '@/components/veenna'
import { cn } from '@/lib/utils'

defineProps<{
  /** Names the modal and the button. */
  title: string
  /** Nothing worth enlarging (an empty state): no button. */
  disabled?: boolean
  class?: string
}>()

const open = ref(false)
</script>

<template>
  <div :class="cn('group/chart relative', $props.class)">
    <slot :expanded="false" />
    <IconButton
      v-if="!disabled"
      :label="`Expand ${title}`"
      class="absolute right-1.5 top-1.5 z-20 bg-veenna-surface/90 opacity-0 shadow-veenna-sm transition-opacity focus-visible:opacity-100 group-hover/chart:opacity-100 [@media(hover:none)]:opacity-100"
      @click="open = true"
    >
      <PhArrowsOut class="h-4 w-4" weight="bold" />
    </IconButton>

    <VeennaModal :open="open" size="xl" title-id="chart-expand-title" @close="open = false">
      <ModalHeader title-id="chart-expand-title" :title="title" @close="open = false" />
      <ModalBody class="flex flex-col">
        <div class="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col">
          <slot :expanded="true" />
        </div>
      </ModalBody>
    </VeennaModal>
  </div>
</template>
