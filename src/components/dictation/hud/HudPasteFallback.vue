<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { PhCheck, PhCopy, PhPause, PhPlay, PhX } from '@phosphor-icons/vue'
import { usePasteFallbackCountdown } from '@/composables/usePasteFallbackCountdown'
import { writeClipboardText } from '@/lib/clipboard/writeClipboardText'

/**
 * Shown when dictated text had nowhere to go: the transcript with a Copy button, dismissed
 * automatically after a countdown that pauses on hover or on request.
 */
const props = defineProps<{ text: string }>()
const emit = defineEmits<{ dismiss: [] }>()

const copied = ref(false)

function dismiss() {
  emit('dismiss')
}

const countdown = usePasteFallbackCountdown(dismiss)

async function copy() {
  const text = props.text.trim()
  if (text) copied.value = await writeClipboardText(text)
}

onMounted(countdown.start)
onUnmounted(countdown.stop)
</script>

<template>
  <div
    class="dictation-hud__paste-fallback-card rounded-md"
    role="dialog"
    aria-label="Dictation text"
    @mouseenter="countdown.pauseOnHover"
    @mouseleave="countdown.resumeOnLeave"
  >
    <div class="dictation-hud__paste-fallback-header">
      <p class="dictation-hud__paste-fallback-hint">Select a textbox first, then dictate</p>
      <button
        type="button"
        class="dictation-hud__paste-fallback-close"
        aria-label="Close"
        @pointerdown.stop
        @click.stop="dismiss"
      >
        <PhX class="h-3.5 w-3.5" weight="bold" />
      </button>
    </div>
    <p class="dictation-hud__paste-fallback-text">
      {{ text }}
    </p>
    <div class="dictation-hud__paste-fallback-footer">
      <button
        type="button"
        class="dictation-hud__paste-fallback-copy"
        @pointerdown.stop
        @click.stop="copy"
      >
        <PhCheck v-if="copied" class="h-3.5 w-3.5" weight="bold" aria-hidden="true" />
        <PhCopy v-else class="h-3.5 w-3.5" weight="bold" aria-hidden="true" />
        {{ copied ? 'Copied' : 'Copy' }}
      </button>
    </div>
    <div class="dictation-hud__paste-fallback-progress-row">
      <button
        type="button"
        class="dictation-hud__paste-fallback-pause"
        :aria-label="countdown.pinnedPaused.value ? 'Resume auto-dismiss' : 'Pause auto-dismiss'"
        @pointerdown.stop
        @click.stop="countdown.togglePinned"
      >
        <PhPlay
          v-if="countdown.pinnedPaused.value"
          class="h-2 w-2"
          weight="fill"
          aria-hidden="true"
        />
        <PhPause v-else class="h-2 w-2" weight="fill" aria-hidden="true" />
      </button>
      <div class="dictation-hud__paste-fallback-progress" aria-hidden="true">
        <div
          class="dictation-hud__paste-fallback-progress-bar"
          :class="{
            'dictation-hud__paste-fallback-progress-bar--paused': countdown.paused.value,
          }"
          :style="{ width: `${countdown.progress.value}%` }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dictation-hud--surface-frost .dictation-hud__paste-fallback-hint,
.dictation-hud--surface-frost .dictation-hud__paste-fallback-text {
  color: rgba(255, 255, 255, 0.92);
}

.dictation-hud--surface-frost .dictation-hud__paste-fallback-hint {
  color: rgba(255, 255, 255, 0.58);
}

.dictation-hud__paste-fallback-card {
  position: relative;
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(16, 16, 16, 0.96);
}

.dictation-hud__paste-fallback-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem 0.35rem;
}

.dictation-hud__paste-fallback-hint {
  margin: 0;
  min-width: 0;
  font-size: 0.6875rem;
  line-height: 1.25;
  color: rgba(255, 255, 255, 0.48);
}

.dictation-hud__paste-fallback-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
  border: none;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.82);
  cursor: pointer;
  -webkit-app-region: no-drag;
}

.dictation-hud__paste-fallback-close:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}

.dictation-hud__paste-fallback-text {
  margin: 0;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.35rem 0.85rem 0.5rem;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.94);
  text-align: left;
  white-space: pre-wrap;
  word-break: break-word;
}

.dictation-hud__paste-fallback-footer {
  display: flex;
  justify-content: flex-end;
  padding: 0 0.75rem 1.4rem;
}

.dictation-hud__paste-fallback-copy {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  border: none;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.14);
  font-size: 0.6875rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  cursor: pointer;
  -webkit-app-region: no-drag;
}

.dictation-hud__paste-fallback-copy:hover {
  background: rgba(255, 255, 255, 0.22);
}

.dictation-hud__paste-fallback-progress-row {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.5rem 0.3rem;
  -webkit-app-region: no-drag;
}

.dictation-hud__paste-fallback-pause {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  border: none;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.72);
  cursor: pointer;
}

.dictation-hud__paste-fallback-pause:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}

.dictation-hud__paste-fallback-progress {
  position: relative;
  flex: 1;
  height: 2px;
  border-radius: 9999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
}

.dictation-hud__paste-fallback-progress-bar {
  height: 100%;
  background: rgba(255, 255, 255, 0.42);
  transition: width 40ms linear;
}

.dictation-hud__paste-fallback-progress-bar--paused {
  transition: none;
}
</style>
