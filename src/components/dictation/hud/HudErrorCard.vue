<script setup lang="ts">
import { PhArrowClockwise } from '@phosphor-icons/vue'

/** The HUD's error card: what went wrong, with Retry (when there is something to retry) and Dismiss. */
defineProps<{ message: string | null; canRetry: boolean }>()
const emit = defineEmits<{ retry: []; dismiss: [] }>()
</script>

<template>
  <div class="dictation-hud__error-card" role="alert" aria-live="assertive">
    <p class="dictation-hud__error-text">{{ message }}</p>
    <div class="dictation-hud__error-actions">
      <button
        v-if="canRetry"
        type="button"
        class="dictation-hud__retry-btn"
        aria-label="Retry dictation"
        @pointerdown.stop
        @click.stop="emit('retry')"
      >
        <PhArrowClockwise class="h-3.5 w-3.5" weight="bold" />
        Retry
      </button>
      <button
        type="button"
        class="dictation-hud__dismiss-btn"
        aria-label="Dismiss error"
        @pointerdown.stop
        @click.stop="emit('dismiss')"
      >
        Dismiss
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Window canvas is 360×260 - use most of it so messages never clip. */
.dictation-hud__error-card {
  display: flex;
  width: min(21rem, calc(100vw - 1rem));
  max-width: 21rem;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.75rem 0.85rem 0.8rem;
  border-radius: 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(16, 16, 16, 0.96);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.dictation-hud__error-text {
  margin: 0;
  /* Full message visible; scroll only if it exceeds the window canvas. */
  max-height: 10.5em;
  overflow-y: auto;
  font-size: 0.78125rem;
  font-weight: 500;
  line-height: 1.4;
  color: rgb(252, 165, 165);
  text-align: left;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.dictation-hud__error-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.35rem;
}

.dictation-hud__retry-btn,
.dictation-hud__dismiss-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.28rem 0.55rem;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.08);
  font-size: 0.6875rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  cursor: pointer;
  -webkit-app-region: no-drag;
}

.dictation-hud__retry-btn:hover,
.dictation-hud__dismiss-btn:hover {
  background: rgba(255, 255, 255, 0.14);
}
</style>
