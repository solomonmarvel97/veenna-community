import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { isCaptureLive } from '@/lib/dictation/dictationEngine'
import { clearDictationRetry } from '@/lib/dictation/dictationRetryCache'

/** push-to-talk, hands-free, or working on a finished recording. */
export type DictationMode = 'idle' | 'ptt' | 'continuous' | 'processing'

export type DictationPhase = 'recording' | 'transcribing' | 'cleaning' | 'inserting' | 'done'

/** What the dictation HUD is showing right now. */
export const useDictationStore = defineStore('dictation', () => {
  const mode = ref<DictationMode>('idle')
  const phase = ref<DictationPhase | null>(null)
  const audioTrack = ref<MediaStreamTrack | null>(null)
  /** Normalized mic bar height from the live level monitor (Electron HUD waveform). */
  const micWaveLevel = ref<number | null>(null)
  const error = ref<string | null>(null)
  const overlayVisible = ref(false)
  const previewText = ref('')
  /** Transcript shown in the HUD when OS paste had no target (copy + auto-dismiss). */
  const pasteFallbackText = ref<string | null>(null)
  const successMessage = ref<string | null>(null)
  /** Show Cancel / OK chrome during hands-free recording. */
  const handsFreeUi = ref(false)

  const isRecording = computed(() => mode.value === 'ptt' || mode.value === 'continuous')
  const showHandsFreeControls = computed(
    () => isRecording.value && (mode.value === 'continuous' || handsFreeUi.value),
  )

  function setHandsFreeUi(enabled: boolean) {
    handsFreeUi.value = Boolean(enabled)
  }

  function setMode(next: DictationMode) {
    // A running recorder holds its session open: it ends by stopping, never by a UI reset.
    if (next === 'idle' && isCaptureLive()) return
    mode.value = next
    const sessionOpen = next === 'ptt' || next === 'continuous' || next === 'processing'
    overlayVisible.value = sessionOpen || Boolean(pasteFallbackText.value) || Boolean(error.value)
    if (next === 'continuous') handsFreeUi.value = true
    if (next === 'idle' || next === 'processing') handsFreeUi.value = false
  }

  function setPhase(next: DictationPhase | null) {
    phase.value = next
    if (next || pasteFallbackText.value || error.value) overlayVisible.value = true
  }

  function setPreviewText(text: string) {
    previewText.value = text
  }

  function setPasteFallbackText(text: string | null) {
    const trimmed = text?.trim() ?? ''
    pasteFallbackText.value = trimmed || null
    if (pasteFallbackText.value) overlayVisible.value = true
  }

  function setSuccessMessage(message: string | null) {
    successMessage.value = message
  }

  function setAudioTrack(track: MediaStreamTrack | null) {
    audioTrack.value = track
  }

  function setMicWaveLevel(level: number | null) {
    micWaveLevel.value = level
  }

  function setError(message: string | null) {
    error.value = message
    if (message) overlayVisible.value = true
  }

  function reset() {
    if (isCaptureLive()) {
      // Only what the last session left on the HUD goes; the live session stays.
      error.value = null
      pasteFallbackText.value = null
      successMessage.value = null
      return
    }
    mode.value = 'idle'
    phase.value = null
    audioTrack.value = null
    micWaveLevel.value = null
    error.value = null
    overlayVisible.value = false
    previewText.value = ''
    pasteFallbackText.value = null
    successMessage.value = null
    handsFreeUi.value = false
    clearDictationRetry()
  }

  /** Collapse recording UI without entering processing (silent / empty dismiss). */
  function endRecordingSession() {
    if (isCaptureLive()) return
    audioTrack.value = null
    micWaveLevel.value = null
    phase.value = null
    mode.value = 'idle'
    overlayVisible.value = false
    handsFreeUi.value = false
  }

  return {
    mode,
    phase,
    audioTrack,
    micWaveLevel,
    error,
    overlayVisible,
    previewText,
    pasteFallbackText,
    successMessage,
    handsFreeUi,
    isRecording,
    showHandsFreeControls,
    setHandsFreeUi,
    setMode,
    setPhase,
    setPreviewText,
    setPasteFallbackText,
    setSuccessMessage,
    setAudioTrack,
    setMicWaveLevel,
    setError,
    reset,
    endRecordingSession,
  }
})
