<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { PhCheck, PhMicrophone, PhSpinner } from '@phosphor-icons/vue'
import HudErrorCard from '@/components/dictation/hud/HudErrorCard.vue'
import HudPasteFallback from '@/components/dictation/hud/HudPasteFallback.vue'
import HudRecordingBar from '@/components/dictation/hud/HudRecordingBar.vue'
import AnimatedDots from '@/components/ui/AnimatedDots.vue'
import { useDictation } from '@/composables/useDictation'
import { useDictationHotkeys } from '@/composables/useDictationHotkeys'
import { useVoiceElectronBridge } from '@/composables/useVoiceElectronBridge'
import { useDictationStore } from '@/stores/dictation'
import { useVoiceSettingsStore } from '@/stores/voiceSettings'
import { getVeennaElectron } from '@/lib/platform/isElectron'
import { isDuckAudioWhileDictatingEnabled } from '@/lib/privacySettings'
import { isHudIdleVisibleSyncEvent } from '@/lib/voice/voiceHudIdleVisible'
import { isHudScreenShareVisibleSyncEvent } from '@/lib/voice/voiceHudScreenShareVisible'
import { isHudAppearanceSyncEvent } from '@/lib/voice/voiceHudAppearance'
import { warmDictationHudSounds } from '@/lib/voice/dictationHudSounds'
import { hasDictationRetry } from '@/lib/dictation/dictationRetryCache'
import type { DictationTrayState } from '@/types/electron'

const store = useDictationStore()
const dictation = useDictation()
const voiceSettings = useVoiceSettingsStore()

const { triggerHandsFreeToggle } = useDictationHotkeys()
useVoiceElectronBridge()

const hudSurfaceClass = computed(
  () => `dictation-hud--surface-${voiceSettings.hudAppearance.surface}`,
)

function onFormatStorage(event: StorageEvent) {
  if (isHudIdleVisibleSyncEvent(event)) {
    voiceSettings.syncHudIdleVisibleFromStorage()
  }
  if (isHudScreenShareVisibleSyncEvent(event)) {
    voiceSettings.syncHudVisibleDuringScreenShareFromStorage()
  }
  if (isHudAppearanceSyncEvent(event)) {
    voiceSettings.syncHudAppearanceFromStorage()
  }
}

const isProcessing = computed(
  () =>
    store.mode === 'processing' ||
    store.phase === 'transcribing' ||
    store.phase === 'inserting' ||
    store.phase === 'done',
)

const isDictating = computed(() => store.isRecording)

/** Compact 40×40 window: idle dots or processing spinner (no wide chrome). */
const isCompact = computed(() => !isDictating.value)

/** Paste had no target - show transcript card with copy + auto-dismiss. */
const showPasteFallbackPanel = computed(
  () =>
    Boolean(store.pasteFallbackText?.trim()) &&
    isCompact.value &&
    !isProcessing.value &&
    !isDictating.value,
)

const showIdleMark = computed(
  () =>
    store.mode === 'idle' &&
    isCompact.value &&
    !isProcessing.value &&
    !store.error &&
    !store.pasteFallbackText,
)

/** Processing: spinner only - idle dots, previous writeup, and pill chrome stay hidden. */
const showProcessingSpinner = computed(() => isCompact.value && isProcessing.value)

/** Wide chrome while recording (waveform / hands-free controls). */
const wantsWideChrome = computed(() => isDictating.value)

/** Hands-free (Option twice): show Cancel / OK beside the pill. */
const showHandsFreeControls = computed(() => store.showHandsFreeControls)

/** Error with optional retry - stays visible until dismissed or retried. */
const showErrorPanel = computed(() => Boolean(store.error) && isCompact.value)

const canRetryDictation = computed(() => hasDictationRetry())

const errorTitle = computed(() => {
  if (!store.error) return ''
  return store.error.length > 72 ? `${store.error.slice(0, 72)}…` : store.error
})

/** Brief success feedback after task/note creation (spinner is hidden). */
const showSuccessFeedback = computed(
  () => store.phase === 'done' && Boolean(store.successMessage?.trim()),
)

const titleLabel = computed(() => {
  if (showErrorPanel.value) return errorTitle.value
  if (showSuccessFeedback.value) return store.successMessage ?? ''
  // Never show Save / status copy on the HUD - spinner only while processing.
  if (isProcessing.value) return ''
  if (isDictating.value) return 'Dictating with veenna'
  return ''
})

/**
 * Status copy only while recording or during the brief post-save acknowledgement. Everything
 * else stays in the compact 40×40 window, which has no room for a line of text beside the pill.
 */
const showTitle = computed(
  () => Boolean(titleLabel.value) && (isDictating.value || showSuccessFeedback.value),
)

/** Single pill container: idle circle → recording bar → processing circle. */
const showCorePill = computed(
  () =>
    showIdleMark.value ||
    isDictating.value ||
    store.phase === 'recording' ||
    showProcessingSpinner.value ||
    showSuccessFeedback.value,
)

const corePillRecording = computed(() => isDictating.value)
const isTransientRecording = computed(() => !isDictating.value && store.phase === 'recording')

/** Session chrome is showing (styling only - the window no longer resizes). */
const overlayChromeExpanded = ref(false)

/**
 * Where the pill sits inside the fixed-size overlay window, in CSS px, as
 * resolved by the main process. Normally the window centre; it shifts only when
 * the window had to be clamped to keep it on screen, so the dot itself still
 * lands exactly on the anchor the user chose.
 *
 * The window never resizes, so there is no stale-frame window to guard against
 * and nothing here can hide the HUD.
 */
const hudPillPoint = ref({ x: 180, y: 130 })

const hudPillStyle = computed(() => ({
  '--hud-pill-x': `${hudPillPoint.value.x}px`,
  '--hud-pill-y': `${hudPillPoint.value.y}px`,
}))

function scheduleOverlayReveal() {
  void getVeennaElectron()?.revealOverlay?.()
}

const contentRef = ref<HTMLElement | null>(null)

/**
 * Tell the main process which part of the window is actually drawn, so the rest
 * stays click-through. Reported after paint; if it never arrives the whole window
 * stays interactive, which is the safe direction to fail.
 */
function reportHitRect() {
  const el = contentRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const left = rect.left
  const top = rect.top
  const right = rect.right
  const bottom = rect.bottom
  if (right <= left || bottom <= top) return
  void getVeennaElectron()?.setOverlayHitRect?.({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  })
}

function resolveTrayState(): DictationTrayState {
  if (store.pasteFallbackText) return 'processing'
  if (store.error) return 'error'
  if (store.isRecording) return 'recording'
  if (
    store.mode === 'processing' ||
    store.phase === 'transcribing' ||
    store.phase === 'cleaning' ||
    store.phase === 'inserting' ||
    store.phase === 'done'
  ) {
    return 'processing'
  }
  return 'idle'
}

watch(
  () =>
    [
      store.mode,
      store.phase,
      store.error,
      store.isRecording,
      store.micWaveLevel,
      store.pasteFallbackText,
    ] as const,
  () => {
    void getVeennaElectron()?.setDictationState?.({
      state: resolveTrayState(),
      duckAudio: isDuckAudioWhileDictatingEnabled(),
    })
  },
  { immediate: true, flush: 'post' },
)

watch(
  [wantsWideChrome, showHandsFreeControls, showErrorPanel, showPasteFallbackPanel],
  async ([wide, handsFree, errorPanel, pasteFallback]) => {
    const shouldExpand = wide || handsFree || errorPanel || pasteFallback
    overlayChromeExpanded.value = shouldExpand
    await getVeennaElectron()?.setOverlayExpanded?.(
      shouldExpand,
      handsFree,
      false,
      false,
      pasteFallback,
    )
    // Layout is a pure DOM change now - the chrome is already correct on screen.
    await nextTick()
    reportHitRect()
    scheduleOverlayReveal()
  },
  { immediate: true, flush: 'post' },
)

function onRetryDictation() {
  void dictation.retryLastDictation()
}

function onDismissPasteFallback() {
  dictation.dismissPasteFallback()
}

function onDismissError() {
  dictation.dismissDictationError()
}

function onIdleLogoClick() {
  triggerHandsFreeToggle()
}

/** Movement past this threshold starts a reposition drag instead of a tap. */
const COMPACT_DRAG_THRESHOLD_PX = 14

const canCompactDrag = computed(
  () =>
    showIdleMark.value ||
    showProcessingSpinner.value ||
    showSuccessFeedback.value ||
    showErrorPanel.value ||
    showPasteFallbackPanel.value,
)

let compactPointerStart: { screenX: number; screenY: number } | null = null
const compactDragging = ref(false)
let compactDragged = false

function onCompactPointerDown(event: PointerEvent) {
  if (!canCompactDrag.value || event.button !== 0) return
  // Hold the window mouse-aware for the whole press - a fast drag can outrun the
  // hit rect, and losing the mouse mid-gesture would strand the drag.
  void getVeennaElectron()?.engageOverlay?.(true)
  compactDragging.value = false
  compactDragged = false
  compactPointerStart = { screenX: event.screenX, screenY: event.screenY }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onCompactPointerMove(event: PointerEvent) {
  if (!canCompactDrag.value || !compactPointerStart) return
  const dx = event.screenX - compactPointerStart.screenX
  const dy = event.screenY - compactPointerStart.screenY
  if (!compactDragging.value) {
    if (Math.hypot(dx, dy) < COMPACT_DRAG_THRESHOLD_PX) return
    compactDragging.value = true
    compactDragged = true
  }
  if (dx !== 0 || dy !== 0) {
    void getVeennaElectron()?.moveOverlayBy?.(dx, dy)
    compactPointerStart = { screenX: event.screenX, screenY: event.screenY }
  }
}

function onCompactPointerUp(event: PointerEvent) {
  if (event.button !== 0 || !compactPointerStart) return
  void getVeennaElectron()?.engageOverlay?.(false)
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId)
  }
  const wasDrag = compactDragged
  compactPointerStart = null
  compactDragging.value = false
  compactDragged = false
  if (!wasDrag && showIdleMark.value) onIdleLogoClick()
}

function onCompactPointerCancel() {
  void getVeennaElectron()?.engageOverlay?.(false)
  compactPointerStart = null
  compactDragging.value = false
  compactDragged = false
}

function onCancelRecording() {
  dictation.requestEndRecording('cancel')
}

function onProcessRecording() {
  dictation.requestEndRecording('finalize')
}

let stopLayoutSync: (() => void) | void
let hitRectObserver: ResizeObserver | null = null

function syncIdleRootClass(idle: boolean) {
  document.documentElement.classList.toggle('dictation-hud-root--idle', idle)
}

function syncPasteFallbackRootClass(active: boolean) {
  document.documentElement.classList.toggle('dictation-hud-root--paste-fallback', active)
}

watch(
  () => showPasteFallbackPanel.value,
  (active) => {
    syncPasteFallbackRootClass(active)
  },
  { immediate: true },
)

function syncErrorRootClass(active: boolean) {
  document.documentElement.classList.toggle('dictation-hud-root--error', active)
}

watch(
  () => showErrorPanel.value,
  (active) => {
    syncErrorRootClass(active)
  },
  { immediate: true },
)

watch(
  () => showIdleMark.value,
  (idle) => {
    syncIdleRootClass(idle)
  },
  { immediate: true },
)

onMounted(() => {
  void warmDictationHudSounds()
  document.documentElement.dataset.veennaSurface = 'dictation-hud'
  document.documentElement.classList.add('dictation-hud-root')
  document.body.classList.add('dictation-hud-root')
  voiceSettings.syncHudIdleVisibleFromStorage()
  voiceSettings.syncHudVisibleDuringScreenShareFromStorage()
  voiceSettings.syncHudAppearanceFromStorage()
  window.addEventListener('storage', onFormatStorage)
  stopLayoutSync = getVeennaElectron()?.onOverlayLayout?.((payload) => {
    const pill = payload?.pill
    if (!pill || !Number.isFinite(pill.x) || !Number.isFinite(pill.y)) return
    hudPillPoint.value = { x: pill.x, y: pill.y }
    void nextTick().then(reportHitRect)
  })
  // Chrome size follows fonts and icon metrics, so re-report on any reflow.
  hitRectObserver = new ResizeObserver(reportHitRect)
  if (contentRef.value) hitRectObserver.observe(contentRef.value)
  reportHitRect()
})

onUnmounted(() => {
  window.removeEventListener('storage', onFormatStorage)
  hitRectObserver?.disconnect()
  hitRectObserver = null
  stopLayoutSync?.()
  syncIdleRootClass(false)
  syncPasteFallbackRootClass(false)
  syncErrorRootClass(false)
  dictation.cancelRecording()
  void getVeennaElectron()?.setDictationState?.({
    state: 'idle',
    duckAudio: isDuckAudioWhileDictatingEnabled(),
  })
  document.documentElement.classList.remove('dictation-hud-root')
  document.body.classList.remove('dictation-hud-root')
})
</script>

<template>
  <div
    class="dictation-hud fixed inset-0 select-none"
    :class="hudSurfaceClass"
    role="status"
    aria-live="polite"
    :aria-label="titleLabel || (showProcessingSpinner ? 'Processing dictation' : 'Dictation')"
  >
    <div
      class="dictation-hud__shell"
      :class="{
        'dictation-hud__shell--expanded': overlayChromeExpanded,
        'dictation-hud__shell--hands-free': showHandsFreeControls,
        'dictation-hud__shell--idle': showIdleMark,
        'dictation-hud__shell--processing': showProcessingSpinner || showSuccessFeedback,
        'dictation-hud__shell--recording': corePillRecording,
        'dictation-hud__shell--paste-fallback': showPasteFallbackPanel,
        'dictation-hud__shell--error': showErrorPanel,
      }"
      :style="hudPillStyle"
    >
      <div ref="contentRef" class="dictation-hud__content">
        <p v-if="showTitle && !showErrorPanel && !corePillRecording" class="dictation-hud__title">
          <AnimatedDots v-if="!showSuccessFeedback" :label="titleLabel" />
          <span v-else>{{ titleLabel }}</span>
        </p>

        <HudRecordingBar
          v-if="corePillRecording"
          :title-label="titleLabel"
          :show-hands-free-controls="showHandsFreeControls"
          @cancel="onCancelRecording"
          @process="onProcessRecording"
        />

        <div v-else class="dictation-hud__row">
          <div
            v-if="showPasteFallbackPanel"
            class="dictation-hud__paste-fallback"
            @pointerdown="onCompactPointerDown"
            @pointermove="onCompactPointerMove"
            @pointerup="onCompactPointerUp"
            @pointercancel="onCompactPointerCancel"
          >
            <HudPasteFallback
              :text="store.pasteFallbackText ?? ''"
              @dismiss="onDismissPasteFallback"
            />
          </div>

          <div
            v-else-if="showErrorPanel"
            class="dictation-hud__error-panel"
            @pointerdown="onCompactPointerDown"
            @pointermove="onCompactPointerMove"
            @pointerup="onCompactPointerUp"
            @pointercancel="onCompactPointerCancel"
          >
            <HudErrorCard
              :message="store.error"
              :can-retry="canRetryDictation"
              @retry="onRetryDictation"
              @dismiss="onDismissError"
            />
          </div>

          <button
            v-else-if="showCorePill"
            type="button"
            class="dictation-hud__core"
            :class="{
              'dictation-hud__core--idle': showIdleMark,
              'dictation-hud__core--processing': showProcessingSpinner || showSuccessFeedback,
              'dictation-hud__core--dragging': compactDragging,
            }"
            :aria-label="
              showIdleMark
                ? 'Start hands-free dictation'
                : showSuccessFeedback
                  ? (store.successMessage ?? 'Done')
                  : 'Processing dictation'
            "
            :disabled="!showIdleMark"
            @pointerdown="onCompactPointerDown"
            @pointermove="onCompactPointerMove"
            @pointerup="onCompactPointerUp"
            @pointercancel="onCompactPointerCancel"
          >
            <div
              class="dictation-hud__pill"
              :class="{
                'dictation-hud__pill--idle': showIdleMark,
                'dictation-hud__pill--processing': showProcessingSpinner || showSuccessFeedback,
                'dictation-hud__pill--transient-recording': isTransientRecording,
              }"
            >
              <PhMicrophone v-if="showIdleMark" class="h-4 w-4" weight="bold" aria-hidden="true" />
              <PhCheck
                v-else-if="showSuccessFeedback"
                class="h-4 w-4"
                weight="bold"
                aria-hidden="true"
              />
              <PhSpinner
                v-else
                class="hud-icon__spinner-spin h-4 w-4"
                weight="bold"
                aria-hidden="true"
              />
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Unified core pill - idle, recording, and processing share one container. */
.dictation-hud__row,
.dictation-hud__core,
.dictation-hud__pill,
.dictation-hud__pill *:not(.hud-icon__spinner-spin) {
  animation: none !important;
  transition: none !important;
}

.dictation-hud__pill :deep(.hud-icon__spinner-spin) {
  animation: hud-spinner-spin 0.85s linear infinite !important;
}

.dictation-hud {
  width: 100%;
  height: 100%;
  background: transparent;
  pointer-events: none;
}

.dictation-hud,
.dictation-hud * {
  box-shadow: none !important;
  text-shadow: none !important;
}

/*
 * Layout invariant - shared with electron/lib/overlayWindow.cjs:
 * the pill sits at the exact center of the window in every mode, and all other
 * chrome (status title, Cancel / OK, mode bar, mode menu) is absolutely
 * positioned around it. The window is only a transparent canvas around that one
 * point, so switching between idle, push-to-talk, hands-free and meeting mode
 * never moves anything on screen.
 */
.dictation-hud__shell {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  /* Only the drawn chrome takes pointer input, not the transparent canvas. */
  pointer-events: none;
  -webkit-app-region: no-drag;
}

.dictation-hud__shell--idle {
  cursor: pointer;
}

/*
 * Sized by the pill row alone - absolute children never grow this box - and
 * pinned to the pill point the main process resolved. That point is the window
 * centre unless the window had to be clamped to the screen edge, in which case
 * the canvas shifted and this shifts back so the dot stays on its anchor.
 */
.dictation-hud__content {
  position: absolute;
  left: var(--hud-pill-x, 50%);
  top: var(--hud-pill-y, 50%);
  transform: translate(-50%, -50%);
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  pointer-events: auto;
  -webkit-app-region: no-drag;
}

.dictation-hud__shell--recording .dictation-hud__content {
  left: 0;
  width: 100%;
  transform: translateY(-50%);
}

.dictation-hud__row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
}

.dictation-hud__core {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: grab;
  pointer-events: auto;
  -webkit-app-region: no-drag;
}

.dictation-hud__core--idle {
  cursor: pointer;
}

.dictation-hud__core--dragging {
  cursor: grabbing;
}

/* Paste fallback is a card, not a pill - it fills the panel window instead. */
/* The transcript card is the only chrome that fills the window instead of
   hanging off the pill, so it drops the pill-point pinning entirely. */
.dictation-hud__shell--paste-fallback .dictation-hud__content {
  position: absolute;
  inset: 0;
  transform: none;
}

.dictation-hud__shell--paste-fallback .dictation-hud__row {
  width: 100%;
  height: 100%;
}

/* Error panel: same treatment - fill the window so the card centres itself. */
.dictation-hud__shell--error .dictation-hud__content {
  position: absolute;
  inset: 0;
  transform: none;
}

.dictation-hud__shell--error .dictation-hud__row {
  width: 100%;
  height: 100%;
}

/* Status copy hangs above the pill; it must never displace it. */
.dictation-hud__title {
  position: absolute;
  bottom: calc(100% + 0.5rem);
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  max-width: min(14rem, calc(100vw - 2rem));
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
  font-size: 0.9375rem;
  font-weight: 500;
  letter-spacing: -0.01em;
  line-height: 1.2;
  color: rgba(255, 255, 255, 0.95);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  -webkit-app-region: drag;
}

.dictation-hud__pill {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  min-width: 2.25rem;
  padding: 0;
  border-radius: 9999px;
  border: none;
  background: rgba(18, 18, 18, 0.92);
  /* Idle / processing repositioning runs through the pointer handlers below. */
  -webkit-app-region: no-drag;
  transition: none;
}

.dictation-hud__pill--idle {
  background: rgba(14, 14, 14, 0.9);
}

.dictation-hud__pill--transient-recording {
  width: 100%;
  min-width: 0;
  padding: 0 0.75rem;
  border-radius: 9999px;
}

.dictation-hud--surface-glass .dictation-hud__pill {
  background: rgba(22, 22, 22, 0.88);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.dictation-hud--surface-frost .dictation-hud__pill {
  background: rgba(28, 28, 28, 0.9);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  color: rgba(255, 255, 255, 0.96);
}

.dictation-hud__pill--processing {
  width: 2.25rem;
  height: 2.25rem;
  min-width: 2.25rem;
  background: rgba(14, 14, 14, 0.92);
}

.dictation-hud__error-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  cursor: grab;
  -webkit-app-region: no-drag;
}

.dictation-hud__paste-fallback {
  display: flex;
  align-items: stretch;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0.5rem;
  pointer-events: auto;
  cursor: grab;
  -webkit-app-region: no-drag;
}
</style>

<style>
/* The two cards share one surface treatment; they live in different components. */
.dictation-hud--surface-glass .dictation-hud__paste-fallback-card,
.dictation-hud--surface-glass .dictation-hud__error-card {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(22, 22, 22, 0.88);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.dictation-hud--surface-frost .dictation-hud__paste-fallback-card,
.dictation-hud--surface-frost .dictation-hud__error-card {
  border-color: rgba(255, 255, 255, 0.34);
  background: rgba(28, 28, 28, 0.9);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  color: rgba(255, 255, 255, 0.96);
}

html.dictation-hud-root,
html.dictation-hud-root body,
html.dictation-hud-root #app,
html[data-veenna-surface='dictation-hud'],
html[data-veenna-surface='dictation-hud'] body,
html[data-veenna-surface='dictation-hud'] #app {
  background: transparent !important;
  background-color: transparent !important;
  overflow: hidden;
}

html.dictation-hud-root.dictation-hud-root--mode-bar,
html.dictation-hud-root.dictation-hud-root--mode-bar body,
html.dictation-hud-root.dictation-hud-root--mode-bar #app,
html.dictation-hud-root.dictation-hud-root--mode-menu,
html.dictation-hud-root.dictation-hud-root--mode-menu body,
html.dictation-hud-root.dictation-hud-root--mode-menu #app {
  overflow: visible;
}

html.dictation-hud-root--idle,
html.dictation-hud-root--idle body,
html.dictation-hud-root--idle body #app {
  cursor: grab;
}

html.dictation-hud-root--paste-fallback,
html.dictation-hud-root--paste-fallback body,
html.dictation-hud-root--paste-fallback body #app,
html.dictation-hud-root--error,
html.dictation-hud-root--error body,
html.dictation-hud-root--error body #app {
  cursor: grab;
}
</style>
