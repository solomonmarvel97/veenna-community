<script setup lang="ts">
import type { PopoverContentEmits, PopoverContentProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { computed } from "vue"
import { reactiveOmit } from "@vueuse/core"
import {
  PopoverContent,
  PopoverPortal,
  useForwardPropsEmits,
} from "reka-ui"
import { cn } from "@/lib/utils"
import { veennaUi } from "@/lib/veennaUi"
import { Z_INDEX_PORTAL_OVERLAY_ABOVE_MODALS } from "@/composables/useZIndexManager"
import type { PopoverOverlayLayer } from "./types"

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<
    PopoverContentProps & {
      class?: HTMLAttributes["class"]
      style?: HTMLAttributes["style"]
      overlayLayer?: PopoverOverlayLayer
    }
  >(),
  {
    align: "center",
    sideOffset: 4,
    overlayLayer: "modal",
  },
)
const emits = defineEmits<PopoverContentEmits>()

const delegatedProps = reactiveOmit(props, "class", "style", "overlayLayer")

const forwarded = useForwardPropsEmits(delegatedProps, emits)

const overlayZIndex = computed(() => Z_INDEX_PORTAL_OVERLAY_ABOVE_MODALS)

const mergedStyle = computed(() => {
  const base = {
    zIndex: overlayZIndex.value,
    pointerEvents: 'auto' as const,
  }
  const s = props.style
  if (typeof s === "object" && s !== null && !Array.isArray(s)) {
    return { ...s, ...base }
  }
  return base
})
</script>

<template>
  <PopoverPortal>
    <PopoverContent
      data-scroll-lock-ignore
      v-bind="{ ...forwarded, ...$attrs }"
      :style="mergedStyle"
      :class="
        cn(
          veennaUi.popoverSurface,
          'w-72 p-4 outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          props.class,
        )
      "
    >
      <slot />
    </PopoverContent>
  </PopoverPortal>
</template>
