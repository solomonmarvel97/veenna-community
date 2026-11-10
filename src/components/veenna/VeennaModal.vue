<script setup lang="ts">
import { onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import { modalPanelClass, veennaUi, type VeennaModalSize } from '@/lib/veennaUi'
import { useOverlayChromeLock } from '@/composables/useOverlayChromeLock'
import { useFocusTrapEscape } from '@/composables/useFocusTrapEscape'
import { Z_INDEX_MODAL } from '@/composables/useZIndexManager'
import {
  acquireVeennaModalOpen,
  isTopVeennaModal,
  nextVeennaModalId,
  setVeennaModalZIndex,
} from '@/lib/veennaModalStack'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    open: boolean
    titleId?: string
    size?: VeennaModalSize
    zIndex?: number
    panelClass?: string
    closeOnBackdrop?: boolean
  }>(),
  {
    size: 'md',
    zIndex: Z_INDEX_MODAL,
    closeOnBackdrop: true,
  },
)

const emit = defineEmits<{ close: [] }>()

const shellEl = ref<HTMLElement | null>(null)
// Teleported to the body, so a radix dialog's focus trap treats this as
// "outside" and pulls focus straight back out of it. Without this, a modal
// opened from inside the worker dialog cannot be typed into at all.
useFocusTrapEscape(shellEl, toRef(props, 'open'))

const modalId = nextVeennaModalId()
let releaseBodyClass: (() => void) | null = null

function acquireBodyClass() {
  if (releaseBodyClass) {
    setVeennaModalZIndex(modalId, props.zIndex)
    return
  }
  releaseBodyClass = acquireVeennaModalOpen(modalId, props.zIndex)
}

function onBackdropClick() {
  if (props.closeOnBackdrop) emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !props.open) return
  if (!isTopVeennaModal(modalId)) return
  e.preventDefault()
  e.stopImmediatePropagation()
  emit('close')
}

onMounted(() => document.addEventListener('keydown', onKeydown, true))
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown, true)
  releaseBodyClass?.()
  releaseBodyClass = null
})

watch(
  () => props.open,
  (open) => {
    if (open) acquireBodyClass()
    else {
      releaseBodyClass?.()
      releaseBodyClass = null
    }
  },
  { immediate: true },
)

watch(
  () => props.zIndex,
  (z) => setVeennaModalZIndex(modalId, z),
)

useOverlayChromeLock(() => props.open)
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="open"
        ref="shellEl"
        :class="veennaUi.modalShell"
        :style="{ zIndex }"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <div class="veenna-modal-backdrop" @click="onBackdropClick" />
        <div :class="cn(modalPanelClass(size), panelClass)">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
