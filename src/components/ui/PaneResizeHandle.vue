<script setup lang="ts">
withDefaults(
  defineProps<{
    /** When true, keep the accent line visible while dragging. */
    active?: boolean
    /** `vertical` splits left/right panes; `horizontal` splits a bottom dock off. */
    orientation?: 'vertical' | 'horizontal'
    /** Tooltip, for a seam that does more than resize. */
    hint?: string
  }>(),
  { orientation: 'vertical', hint: 'Drag to resize · double-click to reset' },
)

const emit = defineEmits<{
  pointerdown: [event: PointerEvent]
  dblclick: [event: MouseEvent]
}>()

function onPointerDown(event: PointerEvent) {
  // Capture so pointerup still fires when the cursor is over an iframe
  // (e.g. Gmail HTML preview) or leaves the window.
  const el = event.currentTarget as HTMLElement | null
  try {
    el?.setPointerCapture?.(event.pointerId)
  } catch {
    /* ignore Unsupported / InvalidStateError */
  }
  emit('pointerdown', event)
}
</script>

<template>
  <div
    role="separator"
    :aria-orientation="orientation"
    aria-label="Resize panel"
    :title="hint"
    class="group relative z-[8] shrink-0 touch-none select-none"
    :class="orientation === 'horizontal' ? 'h-0 w-full cursor-row-resize' : 'w-0 cursor-col-resize'"
    @pointerdown="onPointerDown"
    @dblclick="emit('dblclick', $event)"
  >
    <!-- The hit target: wider than the pill; skips the pane header so New chat stays clickable. -->
    <div
      class="absolute"
      :class="
        orientation === 'horizontal' ? '-top-1.5 h-3 inset-x-0' : 'bottom-0 top-12 -left-1.5 w-3'
      "
      aria-hidden="true"
    />
    <!-- The grab handle: a slim rounded pill centred on the seam. It grows and takes the accent while dragging. -->
    <div
      class="pointer-events-none absolute rounded-full transition-all duration-150 ease-out"
      :class="[
        orientation === 'horizontal'
          ? 'left-1/2 top-0 h-1 -translate-x-1/2 -translate-y-1/2'
          : 'left-0 top-1/2 w-1 -translate-x-1/2 -translate-y-1/2',
        orientation === 'horizontal'
          ? active
            ? 'w-14'
            : 'w-9 group-hover:w-12'
          : active
            ? 'h-14'
            : 'h-9 group-hover:h-12',
        active
          ? 'bg-veenna-accent opacity-100'
          : 'bg-veenna-muted opacity-0 group-hover:opacity-70 group-focus-visible:opacity-70',
      ]"
      aria-hidden="true"
    />
  </div>
</template>
