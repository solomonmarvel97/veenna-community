<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { getVeennaElectron } from '@/lib/platform/isElectron'
import { Z_INDEX_TOAST } from '@/composables/useZIndexManager'

/**
 * The zoom level, floating in the top-right corner while the owner zooms in or
 * out (menu, Cmd +/-, ctrl-wheel). Electron owns the zoom, so the value comes
 * from the main process; it fades away a moment after the last change.
 */
const HIDE_AFTER_MS = 1500

const percent = ref(100)
const visible = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null
let off: (() => void) | void

onMounted(() => {
  off = getVeennaElectron()?.onZoomChanged?.((factor) => {
    percent.value = Math.round(factor * 100)
    visible.value = true
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      visible.value = false
    }, HIDE_AFTER_MS)
  })
})

onBeforeUnmount(() => {
  if (hideTimer) clearTimeout(hideTimer)
  off?.()
})
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-150"
    leave-active-class="transition-opacity duration-300"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="visible"
      class="pointer-events-none fixed right-4 top-4 rounded-md border border-veenna-border bg-veenna-surface px-2.5 py-1 text-label font-medium tabular-nums text-veenna-fg shadow-veenna-sm"
      :style="{ zIndex: Z_INDEX_TOAST }"
      role="status"
      aria-live="polite"
    >
      {{ percent }}%
    </div>
  </Transition>
</template>
