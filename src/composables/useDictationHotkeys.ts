import { onMounted, onUnmounted } from 'vue'
import { useDictation } from '@/composables/useDictation'
import { useDictationStore } from '@/stores/dictation'
import type { DictationForegroundSnapshot, DictationHotkeyPayload } from '@/types/electron'
import {
  detectDictationPlatform,
  isDictationShortcutDown,
  isHandsFreeStopKey,
  syntheticDictationKeyEvent,
} from '@/lib/dictation/dictationHotkey'
import {
  dictationEngine,
  finalizingBlocksNewSession,
  processingBlocksNewSession,
} from '@/lib/dictation/dictationEngine'
import { getVeennaElectron } from '@/lib/platform/isElectron'
import { primeDictationHudSounds } from '@/lib/voice/dictationHudSounds'

/**
 * The dictation keys. Hold Option to dictate (push to talk); double-tap it, or use the
 * hands-free shortcut, to keep recording until you press it again.
 */
export function useDictationHotkeys() {
  const store = useDictationStore()
  const dictation = useDictation()
  const platform = detectDictationPlatform()

  let handsFreeActive = false

  const OPTION_TAP_MAX_HOLD_MS = 300
  const OPTION_DOUBLE_TAP_GAP_MS = 350
  /**
   * PTT only starts after Option has been held this long. A quick tap releases before the
   * timer fires, so single/double taps never flash a recording session.
   */
  const OPTION_HOLD_TO_TALK_DELAY_MS = 100
  let optionDownAt = 0
  let lastQuickTapUpAt = 0
  let pttHoldTimer: ReturnType<typeof setTimeout> | null = null
  let pendingForeground: DictationForegroundSnapshot | null = null

  function clearPttHoldTimer() {
    if (pttHoldTimer) {
      clearTimeout(pttHoldTimer)
      pttHoldTimer = null
    }
  }

  function isHandsFreeRecording() {
    return store.isRecording && (store.mode === 'continuous' || handsFreeActive)
  }

  function stopPushToTalk() {
    if (processingBlocksNewSession(store.mode)) return
    if (finalizingBlocksNewSession()) return

    const heldMs = optionDownAt > 0 ? Date.now() - optionDownAt : Number.POSITIVE_INFINITY
    optionDownAt = 0
    if (heldMs <= OPTION_TAP_MAX_HOLD_MS) lastQuickTapUpAt = Date.now()

    // Released before the hold delay - it was a tap, no session ever started.
    if (pttHoldTimer) {
      clearPttHoldTimer()
      return
    }

    const inPttSession =
      store.mode === 'ptt' || (store.isRecording && store.mode !== 'continuous')

    if (inPttSession) {
      void dictation.finalizeRecording()
      return
    }

    // Hands-free outlives the key: releasing the second tap must not end it.
    if (isHandsFreeRecording()) return

    if (store.mode === 'processing') return

    // Option released without an active session - clear any wake chrome.
    dictation.cancelRecording()
  }

  function enterContinuousMode(foreground?: DictationForegroundSnapshot | null) {
    handsFreeActive = true
    store.setHandsFreeUi(true)
    if (store.mode === 'ptt') {
      store.setMode('continuous')
    } else if (!store.isRecording) {
      void dictation.startRecording('continuous', foreground ?? null)
    } else {
      store.setMode('continuous')
    }
  }

  function approveRecording() {
    handsFreeActive = false
    store.setHandsFreeUi(false)
    void dictation.finalizeRecording()
  }

  function onHandsFreeModeShortcut(foreground?: DictationForegroundSnapshot | null) {
    if (processingBlocksNewSession(store.mode)) return
    if (isHandsFreeRecording() || store.mode === 'continuous') {
      approveRecording()
      return
    }
    // startRecording looks up the foreground app in the background; capture starts now.
    enterContinuousMode(foreground ?? null)
  }

  function onKeyDown(event: KeyboardEvent, foreground?: DictationForegroundSnapshot | null) {
    if (!isDictationShortcutDown(event, platform)) return

    event.preventDefault()
    event.stopPropagation()
    if (event.repeat) return
    if (processingBlocksNewSession(store.mode)) return
    primeDictationHudSounds()

    // Heal a stuck hands-free flag (e.g. a start that bailed mid-flight) so keys keep working.
    if (handsFreeActive && !store.isRecording && !dictationEngine.finalizing) {
      handsFreeActive = false
      store.setHandsFreeUi(false)
    }

    if (isHandsFreeRecording() || store.mode === 'continuous') {
      approveRecording()
      return
    }

    const now = Date.now()
    const isDoubleTap = lastQuickTapUpAt > 0 && now - lastQuickTapUpAt <= OPTION_DOUBLE_TAP_GAP_MS
    lastQuickTapUpAt = 0
    optionDownAt = now

    // Double-tap Option → hands-free.
    if (isDoubleTap) {
      clearPttHoldTimer()
      onHandsFreeModeShortcut(foreground ?? null)
      return
    }

    if (store.mode === 'ptt') return

    // Delay PTT until the hold threshold passes - taps release before this fires.
    pendingForeground = foreground ?? null
    clearPttHoldTimer()
    pttHoldTimer = setTimeout(() => {
      pttHoldTimer = null
      if (processingBlocksNewSession(store.mode) || finalizingBlocksNewSession()) return
      if (store.isRecording) return
      store.setHandsFreeUi(false)
      void dictation.startRecording('ptt', pendingForeground)
    }, OPTION_HOLD_TO_TALK_DELAY_MS)
  }

  function onKeyUp(event: KeyboardEvent) {
    if (event.repeat) return
    if (!isDictationShortcutDown(event, platform) && event.key !== 'Alt') return
    stopPushToTalk()
  }

  function onHandsFreeStopKey(event: KeyboardEvent) {
    if (!isHandsFreeStopKey(event)) return
    if (!store.isRecording && store.mode !== 'continuous') return
    event.preventDefault()
    event.stopPropagation()
    if (store.mode === 'continuous' || handsFreeActive) approveRecording()
  }

  function onEscape(event: KeyboardEvent) {
    if (event.key !== 'Escape') return
    if (
      store.isRecording ||
      store.mode === 'processing' ||
      handsFreeActive ||
      store.error ||
      store.pasteFallbackText
    ) {
      event.preventDefault()
      event.stopPropagation()
      handsFreeActive = false
      store.setHandsFreeUi(false)
      // Escape always stops a recording, even with a message on the HUD.
      if (store.isRecording) dictation.cancelRecording()
      else if (store.error) dictation.dismissDictationError()
      else if (store.pasteFallbackText) dictation.dismissPasteFallback()
      else dictation.cancelRecording()
    }
  }

  function onElectronHotkey(payload: DictationHotkeyPayload) {
    if (payload.action === 'foreground') {
      pendingForeground = payload.foreground ?? pendingForeground
      dictation.patchRecordingForeground(payload.foreground ?? null)
      return
    }

    // This window's own dictation is invisible to the HUD and to Option once you leave it.
    if (payload.action === 'window-left') {
      if (store.isRecording) dictation.requestEndRecording('finalize')
      return
    }

    if (payload.action === 'hands-free-mode' || payload.action === 'toggle-continuous') {
      onHandsFreeModeShortcut(payload.foreground ?? null)
      return
    }

    if (payload.action === 'confirm') {
      if (
        isHandsFreeRecording() ||
        handsFreeActive ||
        store.isRecording ||
        store.mode === 'continuous' ||
        store.mode === 'ptt'
      ) {
        approveRecording()
      }
      return
    }

    if (payload.action === 'down') {
      primeDictationHudSounds()
      onKeyDown(syntheticDictationKeyEvent('down', platform), payload.foreground ?? null)
      return
    }

    if (payload.action === 'up') {
      stopPushToTalk()
    }
  }

  function triggerHandsFreeToggle() {
    if (processingBlocksNewSession(store.mode) || finalizingBlocksNewSession()) return
    onHandsFreeModeShortcut(null)
  }

  let electronUnsub: (() => void) | undefined
  const useGlobalHotkeys = Boolean(getVeennaElectron()?.onDictationHotkey)

  onMounted(() => {
    if (!useGlobalHotkeys) {
      window.addEventListener('keydown', onKeyDown, true)
      window.addEventListener('keyup', onKeyUp, true)
    }
    window.addEventListener('keydown', onHandsFreeStopKey, true)
    window.addEventListener('keydown', onEscape, true)
    electronUnsub = getVeennaElectron()?.onDictationHotkey?.(onElectronHotkey) ?? undefined
  })

  onUnmounted(() => {
    clearPttHoldTimer()
    if (!useGlobalHotkeys) {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
    }
    window.removeEventListener('keydown', onHandsFreeStopKey, true)
    window.removeEventListener('keydown', onEscape, true)
    electronUnsub?.()
  })

  return { onElectronHotkey, triggerHandsFreeToggle }
}
