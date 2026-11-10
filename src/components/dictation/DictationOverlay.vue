<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { PhCheck, PhSpinner, PhX } from '@phosphor-icons/vue'
import DictationWaveform from '@/components/dictation/DictationWaveform.vue'
import AnimatedDots from '@/components/ui/AnimatedDots.vue'
import { useDictation } from '@/composables/useDictation'
import { useDictationStore } from '@/stores/dictation'
import { hasDictationRetry } from '@/lib/dictation/dictationRetryCache'
import { useOverlayChromeLock } from '@/composables/useOverlayChromeLock'

/** The in-app dictation overlay: what is happening, the waveform, and Cancel / Done. */
const store = useDictationStore()
const dictation = useDictation()

const isProcessing = computed(
  () =>
    store.mode === 'processing' ||
    store.phase === 'transcribing' ||
    store.phase === 'inserting' ||
    store.phase === 'done',
)

const showOverlay = computed(() => {
  if (!store.overlayVisible) return false
  return (
    store.isRecording ||
    isProcessing.value ||
    Boolean(store.error) ||
    Boolean(store.pasteFallbackText) ||
    Boolean(store.successMessage)
  )
})

const statusDisplay = computed(() => {
  if (store.error) return { label: 'Something went wrong', animate: false }
  if (store.successMessage) return { label: store.successMessage, animate: false }
  if (isProcessing.value) return { label: '', animate: false }
  return { label: 'Listening', animate: true }
})

const statusLabel = computed(() => {
  const { label } = statusDisplay.value
  if (isProcessing.value) return 'Processing'
  return label || 'Dictation'
})

const showStatusLabel = computed(
  () => Boolean(statusDisplay.value.label) || Boolean(store.successMessage),
)
const showHandsFreeControls = computed(() => store.isRecording)
const previewText = computed(() => store.previewText.trim())
const canRetryDictation = computed(() => Boolean(store.error) && hasDictationRetry())

function onRetryDictation() {
  void dictation.retryLastDictation()
}

function onDismissError() {
  dictation.dismissDictationError()
}

function onCancelRecording() {
  dictation.requestEndRecording('cancel')
}

function onProcessRecording() {
  dictation.requestEndRecording('finalize')
}

watch(
  showOverlay,
  (open) => {
    document.body.classList.toggle('dictation-overlay-open', open)
  },
  { immediate: true },
)

useOverlayChromeLock(() => showOverlay.value)

onBeforeUnmount(() => {
  document.body.classList.remove('dictation-overlay-open')
})
</script>

<template>
  <Teleport to="body">
    <Transition name="dictation-overlay">
      <div
        v-if="showOverlay"
        class="dictation-overlay fixed inset-0 z-[9999]"
        role="status"
        aria-live="polite"
        :aria-label="statusLabel"
      >
        <!-- Catch clicks while dictating. -->
        <div
          class="dictation-overlay__veil absolute inset-0 bg-black/30"
          aria-hidden="true"
          @pointerdown.prevent
          @click.prevent
        />

        <div
          class="dictation-overlay__scrim pointer-events-none absolute inset-x-0 bottom-0"
          aria-hidden="true"
        />

        <div
          class="dictation-overlay__panel pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-14 text-center sm:gap-2.5 sm:pb-[max(2rem,env(safe-area-inset-bottom))] sm:pt-16"
        >
          <p
            v-if="showStatusLabel"
            class="flex items-center justify-center gap-1.5 text-body font-medium tracking-wide text-white/95 sm:text-body"
          >
            <AnimatedDots
              v-if="statusDisplay.animate"
              :label="statusDisplay.label"
              class="font-medium tracking-wide text-white/95 sm:text-body"
            />
            <span v-else>{{ statusDisplay.label }}</span>
          </p>

          <p
            v-if="previewText"
            class="max-w-md whitespace-pre-wrap px-2 text-caption leading-relaxed text-white/80 sm:max-w-lg sm:text-body"
          >
            {{ previewText }}
          </p>

          <div
            v-if="store.isRecording"
            class="dictation-overlay__wave-row flex items-center justify-center gap-1.5 sm:gap-2"
          >
            <button
              v-if="showHandsFreeControls"
              type="button"
              class="dictation-overlay__action dictation-overlay__action--cancel pointer-events-auto"
              aria-label="Cancel recording"
              @click="onCancelRecording"
            >
              <PhX class="h-3.5 w-3.5" weight="bold" />
            </button>

            <DictationWaveform
              class="dictation-overlay__wave shrink-0"
              :active="store.isRecording"
              :audio-track="typeof store.micWaveLevel === 'number' ? null : store.audioTrack"
              :level="store.micWaveLevel"
            />

            <button
              v-if="showHandsFreeControls"
              type="button"
              class="dictation-overlay__action dictation-overlay__action--ok pointer-events-auto"
              aria-label="Process recording"
              @click="onProcessRecording"
            >
              <PhCheck class="h-3.5 w-3.5" weight="bold" />
            </button>
          </div>

          <div
            v-else-if="isProcessing && !store.error"
            class="dictation-overlay__processing flex h-8 w-8 items-center justify-center rounded-full bg-white/20 sm:h-9 sm:w-9"
            aria-hidden="true"
          >
            <PhSpinner
              class="h-4 w-4 animate-spin text-white/95 sm:h-[1.125rem] sm:w-[1.125rem]"
              weight="bold"
            />
          </div>

          <div v-if="store.error" class="pointer-events-auto flex flex-col items-center gap-2">
            <p class="max-w-sm text-center text-caption text-red-300">
              {{ store.error }}
            </p>
            <div class="flex items-center gap-2">
              <button
                v-if="canRetryDictation"
                type="button"
                class="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-caption font-medium text-white hover:bg-white/15"
                @click="onRetryDictation"
              >
                Retry
              </button>
              <button
                type="button"
                class="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-caption font-medium text-white hover:bg-white/15"
                @click="onDismissError"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dictation-overlay {
  isolation: isolate;
}

.dictation-overlay__scrim {
  min-height: min(42vh, 280px);
  height: min(42vh, 280px);
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.96) 0%,
    rgba(0, 0, 0, 0.82) 28%,
    rgba(0, 0, 0, 0.45) 58%,
    rgba(0, 0, 0, 0.12) 82%,
    transparent 100%
  );
}

.dictation-overlay__wave {
  width: 12rem;
  height: 1.4rem;
  flex-shrink: 0;
  contain: strict;
}

.dictation-overlay__action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
  border: none;
  border-radius: 9999px;
  cursor: pointer;
  transition: background 120ms ease;
}

@media (min-width: 640px) {
  .dictation-overlay__action {
    width: 2rem;
    height: 2rem;
  }
}

/* Match DictationHudView hands-free cancel / accept. */
.dictation-overlay__action--cancel {
  background: rgba(220, 38, 38, 0.92);
  color: #fff;
}

.dictation-overlay__action--cancel:hover {
  background: rgba(185, 28, 28, 0.95);
}

.dictation-overlay__action--ok {
  background: rgba(187, 247, 208, 0.95);
  color: #111;
}

.dictation-overlay__action--ok:hover {
  background: #86efac;
}

.dictation-overlay-enter-active,
.dictation-overlay-leave-active {
  transition: opacity 0.22s ease;
}

.dictation-overlay-enter-active .dictation-overlay__panel,
.dictation-overlay-leave-active .dictation-overlay__panel {
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.dictation-overlay-enter-from,
.dictation-overlay-leave-to {
  opacity: 0;
}

.dictation-overlay-enter-from .dictation-overlay__panel,
.dictation-overlay-leave-to .dictation-overlay__panel {
  transform: translateY(16px);
  opacity: 0.65;
}
</style>
