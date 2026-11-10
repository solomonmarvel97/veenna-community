<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import ModalBody from './ModalBody.vue'
import ModalFooter from './ModalFooter.vue'
import ModalHeader from './ModalHeader.vue'
import VeennaButton from './VeennaButton.vue'
import { modalPanelClass, veennaUi } from '@/lib/veennaUi'
import { useOverlayChromeLock } from '@/composables/useOverlayChromeLock'
import { cn } from '@/lib/utils'

export type ListDetailField = {
  label: string
  value: string
  /** Render value in a taller scrollable block (prompts / long text). */
  multiline?: boolean
  /** Use monospace for code-like compose output. */
  monospace?: boolean
  /** Keep tabs, spaces, and line breaks exactly as stored. */
  preserveFormatting?: boolean
  /** Render the value as a link that runs this (e.g. open a linked note). */
  onValueClick?: () => void
}

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    titleId?: string
    fields: ListDetailField[]
    busy?: boolean
    showEdit?: boolean
    /** Label for the primary action button (default Edit). */
    actionLabel?: string
  }>(),
  {
    showEdit: true,
    titleId: 'list-detail-title',
    actionLabel: 'Edit',
  },
)

const emit = defineEmits<{
  close: []
  edit: []
}>()

const panelRef = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})
const dragging = ref(false)
let dragOrigin = { x: 0, y: 0, left: 0, top: 0 }

function resetPosition() {
  panelStyle.value = {}
}

watch(
  () => props.open,
  (open) => {
    document.body.classList.toggle('veenna-modal-open', open)
    if (!open) resetPosition()
  },
)

useOverlayChromeLock(() => props.open)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.classList.remove('veenna-modal-open')
})

function onPointerDown(event: PointerEvent) {
  const target = event.target as HTMLElement | null
  if (!target || !panelRef.value) return
  if (target.closest('button, a, input, textarea, [role="button"]')) return
  if (!target.closest('[data-detail-drag-handle]')) return

  const rect = panelRef.value.getBoundingClientRect()
  dragOrigin = {
    x: event.clientX,
    y: event.clientY,
    left: rect.left,
    top: rect.top,
  }
  panelStyle.value = {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    margin: '0',
  }
  dragging.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value) return
  const dx = event.clientX - dragOrigin.x
  const dy = event.clientY - dragOrigin.y
  const left = Math.min(window.innerWidth - 48, Math.max(8, dragOrigin.left + dx))
  const top = Math.min(window.innerHeight - 48, Math.max(8, dragOrigin.top + dy))
  panelStyle.value = {
    ...panelStyle.value,
    left: `${left}px`,
    top: `${top}px`,
  }
}

function onPointerUp(event: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  try {
    ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="open"
        :class="veennaUi.modalShell"
        style="z-index: 110"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <div class="veenna-modal-backdrop" @click="emit('close')" />
        <div
          ref="panelRef"
          :class="
            cn(
              modalPanelClass('md'),
              dragging ? 'cursor-grabbing' : '',
              Object.keys(panelStyle).length ? '!max-h-[min(88vh,36rem)]' : '',
            )
          "
          :style="panelStyle"
        >
          <div
            data-detail-drag-handle
            class="cursor-grab select-none active:cursor-grabbing"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
          >
            <ModalHeader :title="title" :title-id="titleId" size="sm" @close="emit('close')" />
          </div>
          <ModalBody>
            <dl class="space-y-4">
              <div v-for="field in fields" :key="field.label">
                <dt class="text-label font-medium uppercase tracking-overline text-veenna-muted">
                  {{ field.label }}
                </dt>
                <dd
                  v-if="field.multiline"
                  :class="
                    cn(
                      'mt-1.5 max-h-56 overflow-y-auto rounded-md border border-veenna-border bg-veenna-row/50 px-4 py-2.5 text-body leading-relaxed text-veenna-fg',
                      field.preserveFormatting || field.monospace
                        ? 'whitespace-pre-wrap [tab-size:4]'
                        : 'whitespace-pre-wrap',
                      field.monospace ? 'font-mono text-caption' : undefined,
                    )
                  "
                >
                  {{ field.value || '-' }}
                </dd>
                <dd v-else-if="field.onValueClick" class="mt-1 text-body">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 text-body font-medium text-veenna-accent underline underline-offset-2 transition-opacity hover:opacity-80"
                    @click="field.onValueClick()"
                  >
                    {{ field.value }}
                  </button>
                </dd>
                <dd v-else class="mt-1 text-body text-veenna-fg">
                  {{ field.value || '-' }}
                </dd>
              </div>
            </dl>
          </ModalBody>
          <ModalFooter v-if="showEdit">
            <VeennaButton variant="primary" block :disabled="busy" @click="emit('edit')">
              <slot name="action">
                {{ actionLabel }}
              </slot>
            </VeennaButton>
          </ModalFooter>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
