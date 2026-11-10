<script setup lang="ts">
import { computed } from 'vue'
import { PhArrowLeft, PhArrowRight } from '@phosphor-icons/vue'
import { useRouterHistoryNav } from '@/composables/useRouterHistoryNav'
import { historyShortcutText } from '@/config/historyShortcut'

/** `compact`: smaller buttons for a narrow sidebar, so the arrows never have to go. */
const props = withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
const size = computed(() => (props.compact ? 'h-5 w-5' : 'h-7 w-7'))
const icon = computed(() => (props.compact ? 'h-3.5 w-3.5' : 'h-4 w-4'))

const { canGoBack, canGoForward, back, forward } = useRouterHistoryNav()
</script>

<template>
  <div class="no-drag flex shrink-0 items-center gap-0.5">
    <button
      type="button"
      class="no-drag inline-flex shrink-0 items-center justify-center text-veenna-icon-muted transition-colors hover:text-veenna-fg focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--veenna-focus-subtle)] disabled:pointer-events-none disabled:opacity-35"
      :class="size"
      :title="`Back (${historyShortcutText('back')})`"
      aria-label="Back"
      :disabled="!canGoBack"
      @click="back"
    >
      <PhArrowLeft :class="icon" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="no-drag inline-flex shrink-0 items-center justify-center text-veenna-icon-muted transition-colors hover:text-veenna-fg focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--veenna-focus-subtle)] disabled:pointer-events-none disabled:opacity-35"
      :class="size"
      :title="`Forward (${historyShortcutText('forward')})`"
      aria-label="Forward"
      :disabled="!canGoForward"
      @click="forward"
    >
      <PhArrowRight :class="icon" aria-hidden="true" />
    </button>
  </div>
</template>
