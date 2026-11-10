<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import {
  AlertDialogContent,
  AlertDialogOverlay,
  AlertDialogPortal,
  type AlertDialogContentProps,
} from 'radix-vue'
import { cn } from '@/lib/utils'

// The root is a portal, so stray attributes (data-testid, aria-*) go to the dialog itself.
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    AlertDialogContentProps & {
      class?: HTMLAttributes['class']
      preventCloseOnOutsideClick?: boolean
    }
  >(),
  {
    preventCloseOnOutsideClick: true,
  },
)

const delegatedProps = computed(() => {
  const { class: _, preventCloseOnOutsideClick: __, ...delegated } = props
  return delegated
})

function handleInteractOutside(event: Event) {
  if (props.preventCloseOnOutsideClick) event.preventDefault()
}
</script>

<template>
  <AlertDialogPortal>
    <!--
      Centered with flex, not `left-1/2 -translate-x-1/2`: a half-pixel
      translate puts the panel on a fractional compositor offset and every
      glyph inside it renders soft. Layout centering snaps to the pixel grid.
    -->
    <div
      class="pointer-events-none fixed inset-0 z-[var(--veenna-z-alert-dialog)] flex items-center justify-center"
      data-ui-alert-dialog-portal
    >
      <AlertDialogOverlay
        :class="
          cn(
            'pointer-events-auto absolute inset-0 z-0 veenna-modal-backdrop',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )
        "
      />
      <AlertDialogContent
        v-bind="{ ...$attrs, ...delegatedProps }"
        :class="
          cn(
            'pointer-events-auto relative z-[1] grid w-[95vw] max-w-[var(--veenna-modal-width)] gap-4 rounded-2xl border border-veenna-border bg-veenna-surface p-4 shadow-veenna-sm outline-none duration-200',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            props.class,
          )
        "
        @interact-outside="handleInteractOutside"
        @pointer-down-outside="handleInteractOutside"
      >
        <slot />
      </AlertDialogContent>
    </div>
  </AlertDialogPortal>
</template>
