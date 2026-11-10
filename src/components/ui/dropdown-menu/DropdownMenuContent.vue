<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { DropdownMenuContent, type DropdownMenuContentProps, DropdownMenuPortal } from 'radix-vue'
import { cn } from '@/lib/utils'
import { veennaUi } from '@/lib/veennaUi'
import { Z_INDEX_PORTAL_OVERLAY_ABOVE_MODALS } from '@/composables/useZIndexManager'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    DropdownMenuContentProps & {
      class?: string
      style?: string | Record<string, any>
      disablePortal?: boolean
    }
  >(),
  {
    sideOffset: 4,
    disablePortal: false,
    avoidCollisions: true,
    collisionPadding: 12,
  },
)

const attrs = useAttrs()

const mergedStyle = computed(() => {
  // reka/radix can leave `body { pointer-events: none }` after modal overlays; portaled menus sit
  // outside `#app` (which extension-fixes re-enables), so without this the menu opens but items are dead.
  const base = {
    zIndex: Z_INDEX_PORTAL_OVERLAY_ABOVE_MODALS,
    pointerEvents: 'auto' as const,
  }
  if (typeof props.style === 'object' && props.style !== null && !Array.isArray(props.style)) {
    // Consumer `style` after base so callers can raise z-index (e.g. menus from mobile sidebar sheet).
    return { ...base, ...props.style, pointerEvents: 'auto' as const }
  }
  return base
})

const contentProps = computed(() => reactiveOmit(props, 'class', 'style', 'disablePortal'))
const forwardedContentProps = computed(() => ({
  ...contentProps.value,
  ...attrs,
}))
</script>

<template>
  <DropdownMenuPortal :disabled="disablePortal">
    <DropdownMenuContent
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
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>
