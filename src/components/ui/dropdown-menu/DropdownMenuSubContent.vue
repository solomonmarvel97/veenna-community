<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import {
  DropdownMenuSubContent,
  type DropdownMenuSubContentEmits,
  type DropdownMenuSubContentProps,
} from 'radix-vue'
import { cn } from '@/lib/utils'
import { veennaUi } from '@/lib/veennaUi'
import { Z_INDEX_PORTAL_OVERLAY_ABOVE_MODALS } from '@/composables/useZIndexManager'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    DropdownMenuSubContentProps & { class?: string; style?: string | Record<string, unknown> }
  >(),
  {
    // Measured from the trigger row, which sits inside the parent panel's padding (px-3)
    // and border: 12 + 1 + 2 leaves a 2px gap between the two panels instead of an overlap.
    sideOffset: 15,
    avoidCollisions: true,
    collisionPadding: 12,
  },
)

const emits = defineEmits<DropdownMenuSubContentEmits>()
const attrs = useAttrs()

const mergedStyle = computed(() => {
  const base = {
    zIndex: Z_INDEX_PORTAL_OVERLAY_ABOVE_MODALS,
    pointerEvents: 'auto' as const,
  }
  if (typeof props.style === 'object' && props.style !== null && !Array.isArray(props.style)) {
    return { ...base, ...props.style, pointerEvents: 'auto' as const }
  }
  return base
})

const contentProps = computed(() => reactiveOmit(props, 'class', 'style'))
const forwardedContentProps = computed(() => ({
  ...contentProps.value,
  ...attrs,
}))
</script>

<template>
  <DropdownMenuSubContent
    data-scroll-lock-ignore
    v-bind="forwardedContentProps"
    :style="mergedStyle"
    :class="
      cn(
        veennaUi.popoverSurface,
        'veenna-popover-surface box-border max-h-[calc(100dvh-1rem)] overflow-x-hidden overflow-y-auto overscroll-contain duration-motion-normal ease-motion-standard',
        veennaUi.menuPanel,
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        props.class,
      )
    "
    @escape-key-down="emits('escapeKeyDown', $event)"
    @pointer-down-outside="emits('pointerDownOutside', $event)"
    @focus-outside="emits('focusOutside', $event)"
    @interact-outside="emits('interactOutside', $event)"
    @entry-focus="emits('entryFocus', $event)"
    @open-auto-focus="emits('openAutoFocus', $event)"
    @close-auto-focus="emits('closeAutoFocus', $event)"
  >
    <slot />
  </DropdownMenuSubContent>
</template>
