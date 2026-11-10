<script setup lang="ts">
import { PhCheck, PhX } from '@phosphor-icons/vue'
import DictationWaveform from '@/components/dictation/DictationWaveform.vue'
import AnimatedDots from '@/components/ui/AnimatedDots.vue'
import { useDictationStore } from '@/stores/dictation'

/** The HUD while recording: the live waveform and, in hands-free mode, Cancel and OK. */
defineProps<{ titleLabel: string; showHandsFreeControls: boolean }>()
const emit = defineEmits<{ cancel: []; process: [] }>()

const store = useDictationStore()
</script>

<template>
  <div
    class="dictation-hud__working rounded-md"
    role="group"
    :aria-label="titleLabel || 'Recording'"
  >
    <div class="dictation-hud__working-header">
      <span class="dictation-hud__working-tag">
        <AnimatedDots :label="titleLabel" />
      </span>
    </div>

    <div class="dictation-hud__working-wave">
      <DictationWaveform
        class="dictation-hud__wave dictation-hud__wave--wide"
        :active="store.isRecording"
        :audio-track="typeof store.micWaveLevel === 'number' ? null : store.audioTrack"
        :level="store.micWaveLevel"
      />
    </div>

    <div v-if="showHandsFreeControls" class="dictation-hud__working-footer">
      <button
        type="button"
        class="dictation-hud__working-action dictation-hud__working-action--icon dictation-hud__working-action--cancel"
        aria-label="Cancel recording"
        title="Cancel recording"
        @click.stop="emit('cancel')"
      >
        <PhX class="h-3.5 w-3.5" weight="bold" />
      </button>
      <button
        type="button"
        class="dictation-hud__working-action dictation-hud__working-action--icon dictation-hud__working-action--ok"
        aria-label="Process recording"
        title="Process recording"
        @click.stop="emit('process')"
      >
        <PhCheck class="h-3.5 w-3.5" weight="bold" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/*
 * The recording card: one rounded-md box holding the status tag, waveform, and
 * (in hands-free / meeting-stop) the mode tags, actions or confirm row - instead
 * of a pill with buttons and a mode bar scattered as separate floating pieces.
 */
.dictation-hud__working {
  display: flex;
  width: 100%;
  box-sizing: border-box;
  flex-direction: column;
  align-items: stretch;
  gap: 0.55rem;
  width: min(100%, calc(100vw - 0.5rem));
  box-sizing: border-box;
  padding: 0.7rem 0.5rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(16, 16, 16, 0.96);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  pointer-events: auto;
  cursor: grab;
  -webkit-app-region: drag;
}

.dictation-hud--surface-glass .dictation-hud__working,
.dictation-hud--surface-frost .dictation-hud__working {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(22, 22, 22, 0.9);
}

.dictation-hud__working-header {
  display: flex;
  align-items: center;
  justify-content: center;
}

.dictation-hud__working-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.55rem 0.2rem 0.45rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.08);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: rgba(255, 255, 255, 0.92);
}

.dictation-hud__working-wave {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 2rem;
  padding: 0 0.25rem;
}

.dictation-hud__wave--wide {
  width: 100%;
  height: 1.5rem;
}

.dictation-hud__working-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  -webkit-app-region: no-drag;
}

.dictation-hud__working-action {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.65rem;
  border: none;
  border-radius: 9999px;
  font-family: inherit;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  cursor: pointer;
  pointer-events: auto;
}

.dictation-hud__working-action--icon {
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  justify-content: center;
  padding: 0;
}

.dictation-hud__working-action--cancel {
  background: #dc2626;
  color: #fff;
}

.dictation-hud__working-action--cancel:hover {
  background: #ef4444;
}

.dictation-hud__working-action--ok {
  background: rgba(187, 247, 208, 0.95);
  color: #111;
}

.dictation-hud__working-action--ok:hover {
  background: #86efac;
}
.dictation-hud__wave {
  width: 6.25rem;
  height: 1rem;
  --dictation-wave-color: rgba(255, 255, 255, 0.98);
}
</style>
