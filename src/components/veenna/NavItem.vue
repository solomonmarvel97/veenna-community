<script setup lang="ts">
import { cn } from '@/lib/utils'
import { isElectronMainWindow } from '@/lib/platform/isElectron'

const props = withDefaults(
  defineProps<{
    active?: boolean
    indent?: boolean
    variant?: 'default' | 'smart'
    disabled?: boolean
    /** Key hint ("⇧O") shown faintly at the far right while the row is hovered. */
    shortcut?: string
    class?: string
  }>(),
  { active: false, indent: false, variant: 'default', disabled: false },
)

const emit = defineEmits<{ click: [event: MouseEvent] }>()

/** The desktop app uses the compact row at any window width; only the web follows the `lg` breakpoint. */
const smartRowClass = isElectronMainWindow
  ? 'h-8 gap-2.5 rounded-md px-1.5 py-0'
  : 'gap-2.5 rounded-md px-2.5 py-2.5 max-lg:min-h-[44px] lg:h-8 lg:px-1.5 lg:py-0'
const shortcutHideClass = isElectronMainWindow ? '' : 'max-lg:hidden'

let skipClick = false

function onPointerDown(event: PointerEvent) {
  if (props.disabled) return
  if (event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  skipClick = true
  emit('click', event as unknown as MouseEvent)
}

function onClick(event: MouseEvent) {
  if (props.disabled) return
  if (skipClick) {
    skipClick = false
    return
  }
  emit('click', event)
}
</script>

<template>
  <button
    type="button"
    data-nav-item
    :data-active="active ? 'true' : undefined"
    :disabled="disabled"
    :aria-disabled="disabled ? 'true' : undefined"
    :class="
      cn(
        'group flex w-full items-center text-left text-body transition-colors focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--veenna-focus-subtle)]',
        variant === 'smart' ? smartRowClass : 'h-8 gap-2 rounded-md px-2 py-0',
        indent && 'pl-6',
        disabled && 'cursor-not-allowed opacity-40',
        // Smart rows mark selection by brightness, not a fill: the chosen row is
        // full strength and the rest sit a little grayed until hovered.
        active
          ? variant === 'smart'
            ? 'font-medium text-veenna-fg'
            : 'bg-veenna-row-hover font-medium text-veenna-fg'
          : variant === 'smart'
            ? 'text-veenna-muted hover:text-veenna-fg'
            : 'text-veenna-fg hover:bg-veenna-row-hover',
        disabled && variant === 'smart' && 'hover:text-veenna-muted',
        props.class,
      )
    "
    @pointerdown="onPointerDown"
    @click="onClick"
  >
    <span
      v-if="$slots.icon"
      :class="
        cn(
          'inline-flex shrink-0 items-center justify-center overflow-hidden text-veenna-icon',
          variant === 'smart' && 'text-veenna-icon transition-opacity',
          variant === 'smart' && !active && 'opacity-70 group-hover:opacity-100',
        )
      "
    >
      <slot name="icon" />
    </span>
    <span class="nav-item-label min-w-0 flex-1 truncate"><slot /></span>
    <span
      v-if="$slots.trailing"
      class="nav-item-trailing shrink-0 text-caption tabular-nums text-veenna-muted"
    >
      <slot name="trailing" />
    </span>
    <kbd
      v-else-if="shortcut"
      :class="[
        'nav-item-shortcut shrink-0 font-sans text-caption tabular-nums text-veenna-muted opacity-0 transition-opacity group-hover:opacity-50',
        shortcutHideClass,
      ]"
      aria-hidden="true"
    >
      {{ shortcut }}
    </kbd>
  </button>
</template>
