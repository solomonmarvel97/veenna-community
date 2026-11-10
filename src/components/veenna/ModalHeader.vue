<script setup lang="ts">
import { PhX } from '@phosphor-icons/vue'
import { cn } from '@/lib/utils'
import IconButton from './IconButton.vue'

withDefaults(
  defineProps<{
    title: string
    titleId?: string
    size?: 'sm' | 'lg'
    showClose?: boolean
  }>(),
  {
    size: 'lg',
    showClose: true,
  },
)

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <!-- One header for every dialog: a 48px bar, the title at normal size, the close button at the right, a line below. No subtext under the title. -->
  <header
    :class="
      cn(
        'flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-veenna-divider py-2 pl-4 pr-2.5',
      )
    "
  >
    <div class="min-w-0 flex-1">
      <div class="flex min-w-0 items-center gap-2">
        <h2 :id="titleId" class="truncate text-body font-medium leading-tight text-veenna-fg">
          {{ title }}
        </h2>
        <!-- Badges and the like, on the title's own line rather than under it. -->
        <slot name="title-after" />
      </div>
    </div>
    <!-- Header buttons that sit just before the close button. -->
    <div v-if="$slots.actions" class="flex shrink-0 items-center gap-1">
      <slot name="actions" />
    </div>
    <IconButton
      v-if="showClose"
      size="md"
      label="Close"
      class="text-veenna-fg/60 hover:text-veenna-fg"
      @click="emit('close')"
    >
      <slot name="close-icon">
        <PhX class="h-4 w-4" weight="bold" />
      </slot>
    </IconButton>
  </header>
</template>
