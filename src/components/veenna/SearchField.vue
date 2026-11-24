<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { PhMagnifyingGlass, PhSpinner, PhX } from '@phosphor-icons/vue'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * The one search control in Veenna. Closed it is only the search icon; a click opens it into
 * the field with the magnifier inside and an x on the right. The x (or Escape, or leaving an
 * empty field) clears the text and folds it back to the icon. While there is text it stays open.
 * `v-model:open` lets a page step its other controls aside while the field is open.
 */
const props = withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    /** Layout for the open field (width, flex) only. Colour, height and type are not options. */
    class?: string
    /** A search is running: the magnifier becomes a spinner. */
    loading?: boolean
    /** Open as soon as it appears (a picker whose only job is to search). */
    startOpen?: boolean
  }>(),
  { placeholder: 'Search…', modelValue: '' },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const open = defineModel<boolean>('open', { default: false })
if (props.startOpen) open.value = true

const root = ref<HTMLElement | null>(null)
const expanded = computed(() => open.value || Boolean(props.modelValue))

// Whoever opens it (the icon, a keyboard shortcut, a page that swaps its header) lands in the field.
function focusInput() {
  void nextTick(() => root.value?.querySelector('input')?.focus())
}
watch(open, (isOpen) => {
  if (isOpen) focusInput()
})
onMounted(() => {
  if (open.value) focusInput()
})

function openField() {
  open.value = true
}

function closeField() {
  emit('update:modelValue', '')
  open.value = false
}

function onFocusOut(event: FocusEvent) {
  if (props.modelValue) return
  const next = event.relatedTarget as Node | null
  if (next && root.value?.contains(next)) return
  open.value = false
}

function onEscape(event: KeyboardEvent) {
  if (!expanded.value) return
  event.stopPropagation()
  closeField()
}
</script>

<template>
  <button
    v-if="!expanded"
    type="button"
    :class="
      cn(
        'veenna-search-toggle inline-flex h-8 w-8 shrink-0 items-center justify-center text-veenna-icon-muted transition-colors hover:text-veenna-fg focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--veenna-focus-subtle)]',
      )
    "
    :title="placeholder"
    :aria-label="placeholder"
    @click="openField"
  >
    <PhSpinner v-if="loading" class="h-4 w-4 animate-spin" weight="light" aria-hidden="true" />
    <PhMagnifyingGlass v-else class="h-4 w-4" weight="light" aria-hidden="true" />
  </button>
  <div
    v-else
    ref="root"
    :class="
      cn(
        'veenna-field-wrap relative flex h-8 items-center rounded-sm border border-veenna-search-border bg-veenna-search-bg shadow-veenna-search',
        $props.class,
      )
    "
    @focusout="onFocusOut"
    @keydown.esc="onEscape"
  >
    <span class="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-veenna-icon-muted">
      <PhSpinner v-if="loading" class="h-4 w-4 animate-spin" weight="light" aria-hidden="true" />
      <PhMagnifyingGlass v-else class="h-4 w-4" weight="light" aria-hidden="true" />
    </span>
    <Input
      :model-value="modelValue"
      type="search"
      :placeholder="placeholder"
      :aria-label="placeholder"
      class="veenna-field veenna-field-ghost h-8 min-w-0 border-0 bg-transparent pl-8 pr-8 text-body shadow-none focus-visible:bg-transparent"
      @update:model-value="emit('update:modelValue', $event as string)"
    />
    <button
      type="button"
      class="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm text-veenna-muted transition-colors hover:text-veenna-fg"
      title="Close search"
      aria-label="Close search"
      @mousedown.prevent
      @click="closeField"
    >
      <PhX class="h-3.5 w-3.5" weight="light" aria-hidden="true" />
    </button>
  </div>
</template>

<style>
/* The browser's own clear cross inside a search input would sit under ours. */
.veenna-field-wrap input[type='search']::-webkit-search-cancel-button,
.veenna-field-wrap input[type='search']::-webkit-search-decoration {
  -webkit-appearance: none;
  appearance: none;
}
</style>
