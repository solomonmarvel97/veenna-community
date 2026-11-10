<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import { PhX } from '@phosphor-icons/vue'
import { AlertDialogCancel, AlertDialogTitle, type AlertDialogTitleProps } from 'radix-vue'
import { cn } from '@/lib/utils'

const props = defineProps<AlertDialogTitleProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <!-- The dialog's header bar: the title at normal size, the close button on the right, a line below. -->
  <div
    class="-mx-4 -mt-4 mb-4 flex items-center justify-between gap-3 border-b border-veenna-divider py-2 pl-4 pr-2.5"
  >
    <AlertDialogTitle
      v-bind="delegatedProps"
      :class="cn('min-w-0 text-body font-medium leading-tight text-veenna-fg', props.class)"
    >
      <slot />
    </AlertDialogTitle>
    <AlertDialogCancel
      class="inline-grid size-7 shrink-0 place-items-center rounded-md text-veenna-muted transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      aria-label="Close"
    >
      <PhX class="size-4" weight="bold" aria-hidden="true" />
    </AlertDialogCancel>
  </div>
</template>
