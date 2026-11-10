<script setup lang="ts">
import type { SelectContentEmits, SelectContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { SelectContent, SelectPortal, SelectViewport, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@/lib/utils'
import { veennaUi } from '@/lib/veennaUi'
import { Z_INDEX_PORTAL_OVERLAY_ABOVE_MODALS } from '@/composables/useZIndexManager'
import { SelectScrollDownButton, SelectScrollUpButton } from '.'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<
    SelectContentProps & { class?: HTMLAttributes['class']; style?: HTMLAttributes['style'] }
  >(),
  {
    position: 'popper',
    /** When true (reka-ui default), nested modals stack body pointer-events so clicks on the dialog never reach "outside" - the list stays open. False matches OS-style dismiss on any real outside tap (e.g. Select inside Dialog). */
    disableOutsidePointerEvents: false,
    /**
     * reka-ui sets `document.body.style.pointerEvents = 'none'` while locked; portaled content does not reliably
     * opt back in, so clicks pass through to whatever is behind.
     */
    bodyLock: false,
  },
)
const emits = defineEmits<SelectContentEmits>()

const delegatedProps = reactiveOmit(props, 'class', 'style')

const forwarded = useForwardPropsEmits(delegatedProps, emits)

const mergedStyle = computed(() => {
  const base: Record<string, string | number> = {
    zIndex: Z_INDEX_PORTAL_OVERLAY_ABOVE_MODALS,
    pointerEvents: 'auto',
  }
  const s = props.style
  if (typeof s === 'object' && s !== null && !Array.isArray(s)) {
    return { ...s, ...base }
  }
  return base
})
</script>

<template>
  <SelectPortal>
    <SelectContent
      data-scroll-lock-ignore
      v-bind="{ ...forwarded, ...$attrs }"
      :style="mergedStyle"
      :class="
        cn(
          veennaUi.popoverSurface,
          'relative max-h-96 min-w-32 overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
          props.class,
        )
      "
      @pointer-down-outside="(e) => e.stopPropagation()"
    >
      <SelectScrollUpButton />
      <!-- Match reka-ui Popper CSS vars (SelectPopperPosition); avoid h-[--x] without var() - broken height breaks clicks. -->
      <SelectViewport
        :class="
          cn(
            veennaUi.menuPanelPad,
            position === 'popper' &&
              'max-h-[min(15rem,var(--reka-select-content-available-height,15rem))] w-full min-w-[var(--reka-select-trigger-width,100%)]',
          )
        "
      >
        <slot />
      </SelectViewport>
      <SelectScrollDownButton />
    </SelectContent>
  </SelectPortal>
</template>
