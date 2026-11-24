import { useDictationStore, type DictationMode } from '@/stores/dictation'
import { useVoiceCapturesStore } from '@/stores/voiceCaptures'
import { useVoiceSettingsStore } from '@/stores/voiceSettings'
import { resolveSttLanguage } from '@/lib/voice/voiceDictationHelpers'
import { playDictationHudSound, primeDictationHudSounds } from '@/lib/voice/dictationHudSounds'
import { dictationEngine, disposeMicMonitor, prewarmMicrophone, RECORDER_TIMESLICE_MS, scheduleWarmMicRelease, scheduleHudReset, clearHudResetTimer, isMicWarm, armMaxDurationTimer, clearMaxDurationTimer, discardStrayRecorders, recordingElapsedMs, finalizingBlocksNewSession } from '@/lib/dictation/dictationEngine'
import { captureActiveDictationInsertTarget, ensureDictationInsertFocusTracking, insertDictationTextAtCursor, type DictationInsertDeliveryOptions } from '@/lib/dictation/insertAtCursor'
import { type DictationForegroundContext, normalizeForegroundContext } from '@/lib/dictation/appContext'
import type { DictationForegroundSnapshot } from '@/types/electron'
import { collapseRepeatedPhrases } from '@/lib/dictation/collapseRepeatedPhrases'
import { waitForTrailingSpeech } from '@/lib/dictation/trailingSpeech'
import { MIN_DICTATION_HOLD_MS, MIN_DICTATION_SPEECH_MS, readMonitorSampled, readSpeechDurationMs, readSpeakingMs, shouldRejectDictationTranscript, shouldSkipDictationTranscription } from '@/lib/dictation/dictationSilence'
import { clearPendingCaptureAudio, peekPendingCaptureAudio, preferredPlaybackBlob, setPendingCaptureAudio } from '@/lib/voice/captureAudioStore'
import { isMicPermissionError, recoverDictationMicPermission } from '@/lib/dictation/ensureDictationPermissions'
import { transcribeGuestBlob, preloadGuestSttModel } from '@/lib/voice/localStt'
import { ensureLocalSpeechModelInstalled } from '@/lib/voice/ensureLocalSpeechModel'
import { startLiveSegments, type LiveResult } from '@/lib/dictation/liveSegments'
import { isElectron } from '@/lib/platform/isElectron'
import { useToast } from '@/components/ui/toast/use-toast'
import { startDictationTimer, startPasteDictationTimer, timingPreview } from '@/lib/dictation/dictationTiming'
import { getDictationRetry, patchDictationRetry, saveDictationRetry, type DictationRetryPayload } from '@/lib/dictation/dictationRetryCache'

import { snapshotTextInputFocusAtCapture, snapshotForegroundAtRecordingEnd, resolveDictationDeliveryTarget, fillRecordingAppContext } from '@/lib/dictation/deliveryTarget'

import { createMicControls } from '@/lib/dictation/micControls'

/**
 * Veenna Community dictation: record, transcribe on this device, put the text where the cursor
 * is, and keep the capture. Nothing is sent anywhere, and no language model is involved.
 */

/** Let the HUD paint the processing spinner before heavy work continues. */
function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

function retryCaptureId(): string | undefined {
  return getDictationRetry()?.captureId || undefined
}

function dictationErrorMessage(err: unknown): string {
  return err instanceof Error && err.message.trim()
    ? err.message.trim()
    : 'Dictation failed. Please try again.'
}


export function useDictation() {
  const store = useDictationStore()
  const captures = useVoiceCapturesStore()
  const voiceSettings = useVoiceSettingsStore()
  const { toast } = useToast()

  ensureDictationInsertFocusTracking()

  const { releaseMic, ensureMic, attachMicMonitor, createMediaRecorder } = createMicControls(store)

  function cancelLiveTranscription() {
    dictationEngine.liveSegments?.cancel()
    dictationEngine.liveSegments = null
  }

  function finishLiveTranscription(): Promise<LiveResult> | undefined {
    const live = dictationEngine.liveSegments
    dictationEngine.liveSegments = null
    return live?.finish()
  }

  function prepareNewSession() {
    clearHudResetTimer()
    dictationEngine.startedAt = 0
    dropStrayCapture()
  }

  function restoreStartingSession(mode: Exclude<DictationMode, 'idle' | 'processing'>) {
    if (store.isRecording) return
    store.setMode(mode)
    store.setPhase('recording')
  }

  function resetHudAfter(delayMs: number) {
    scheduleHudReset(() => {
      if (!store.isRecording) store.reset()
    }, delayMs)
  }

  async function stopOneRecorder(
    recorder: MediaRecorder | null,
    chunks: Blob[],
  ): Promise<Blob | null> {
    if (!recorder || recorder.state === 'inactive') {
      return chunks.length ? new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' }) : null
    }
    return new Promise((resolve) => {
      recorder.onstop = () => {
        resolve(
          chunks.length
            ? new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || 'audio/webm' })
            : null,
        )
      }
      // A paused meeting recorder must stop too, or it outlives its session.
      try {
        recorder.requestData()
      } catch {
        /* ignore */
      }
      recorder.stop()
    })
  }

  async function stopMediaRecorder(): Promise<Blob | null> {
    // Every way a session ends comes through here. One that wants the live text
    // has already taken it with finishLiveTranscription.
    cancelLiveTranscription()
    const recorder = dictationEngine.recorder
    const mic = await stopOneRecorder(recorder, dictationEngine.chunks)
    if (dictationEngine.recorder === recorder) {
      dictationEngine.recorder = null
      // Audio belongs to one session: a later stop with no recorder must not replay it.
      dictationEngine.chunks = []
    }
    return mic
  }

  async function insertAtCursor(text: string, delivery: DictationInsertDeliveryOptions = {}) {
    return insertDictationTextAtCursor(text, delivery)
  }


  function patchRecordingForeground(
    foreground?: DictationForegroundSnapshot | DictationForegroundContext | null,
  ) {
    if (!store.isRecording || !foreground) return
    const fromHotkey = normalizeForegroundContext(foreground, 'os')
    if (fromHotkey) dictationEngine.capturedAppContext = fromHotkey
    // The OS snapshot arrives after 'down' (see sendActionWithForeground) - keep its
    // AX text-focus flag so delivery can paste into external apps like browsers.
    if ((foreground as DictationForegroundSnapshot).textInputFocused) {
      dictationEngine.hadTextInputFocusAtCapture = true
    }
  }

  function markDictationFailed(message: string, timer?: ReturnType<typeof startDictationTimer>) {
    playDictationHudSound('error')
    store.setError(message)
    store.setMode('idle')
    store.setPhase(null)
    store.setAudioTrack(null)
    timer?.end('error', message)
  }

  async function markDictationFailedMaybePermission(
    err: unknown,
    fallbackMessage: string,
    timer?: ReturnType<typeof startDictationTimer>,
  ) {
    const recovery = await recoverDictationMicPermission(
      isMicPermissionError(err) ? err : undefined,
    )
    if (recovery?.needsPermission) {
      markDictationFailed(recovery.message, timer)
      return true
    }
    markDictationFailed(fallbackMessage, timer)
    return false
  }

  function dismissPasteFallback() {
    if (store.isRecording) {
      store.setPasteFallbackText(null)
      return
    }
    dictationEngine.capturedAppContext = null
    dictationEngine.capturedInsertTarget = null
    dictationEngine.hadTextInputFocusAtCapture = false
    dictationEngine.foregroundAtRecordingEnd = null
    store.reset()
  }


  /** Stops a recorder nothing owns (a session that never finished). */
  function dropStrayCapture(): boolean {
    return discardStrayRecorders()
  }

  function onMaxDurationReached() {
    if (dictationEngine.finalizing) return
    if (store.isRecording) {
      void finalizeRecording()
      return
    }
    if (dropStrayCapture()) releaseMic(true)
  }

  /**
   * A dictation also transcribes as it goes, so release has little left to do: each stretch
   * of speech goes to the on-device model in its own process while the next is still being said.
   */
  function startLiveTranscription(media: MediaStream) {
    cancelLiveTranscription()
    // On the web the model would run in this thread and stall the recording.
    if (!isElectron) return
    const language = resolveSttLanguage(voiceSettings.sttLanguage)
    dictationEngine.liveSegments = startLiveSegments({
      createRecorder: () => createMediaRecorder(media),
      timesliceMs: RECORDER_TIMESLICE_MS,
      hadSpeechWithinMs: (ms) => dictationEngine.micMonitor?.hadSpeechWithinMs(ms) ?? false,
      speechMs: () => dictationEngine.micMonitor?.speechDurationMs() ?? 0,
      speechMeasured: () => readMonitorSampled(dictationEngine.micMonitor),
      basePrompt: () => '',
      transcribe: ({ blob, durationMs }) =>
        transcribeGuestBlob(blob, { language, durationMs }).then((result) => result.text),
    })
  }

  async function startRecording(
    mode: Exclude<DictationMode, 'idle' | 'processing'>,
    foreground?: DictationForegroundSnapshot | DictationForegroundContext | null,
  ) {
    if (store.isRecording || finalizingBlocksNewSession()) return
    prepareNewSession()
    primeDictationHudSounds()
    // Guards every await below: a key release mid-startup finalizes/cancels the session and
    // bumps the token, so this continuation must bail instead of resurrecting a dead session.
    const sessionToken = ++dictationEngine.startToken
    const startAbandoned = () => dictationEngine.startToken !== sessionToken

    if (isElectron) {
      const ensured = await ensureLocalSpeechModelInstalled({
        onProgress: (progress) => {
          const pct = Math.max(0, Math.min(100, Math.round(progress.percent || 0)))
          store.setError(
            pct > 0 ? `Downloading ${progress.label}… ${pct}%` : `Downloading ${progress.label}…`,
          )
        },
      })
      if (startAbandoned()) return
      if (!ensured.ok) {
        store.setError(ensured.reason || 'Local speech model is not installed.')
        store.setMode('idle')
        store.setPhase(null)
        return
      }
      store.setError(null)
      // Warm at key-down: a loaded model is a no-op.
      void preloadGuestSttModel()
    }

    // Snapshot caret only if a field is live, or the mic button just stole focus.
    dictationEngine.capturedInsertTarget = captureActiveDictationInsertTarget()

    // Arm HUD chrome immediately - never flash idle logo during async mic / context setup.
    store.setError(null)
    store.setPreviewText('')
    store.setSuccessMessage(null)
    store.setPasteFallbackText(null)
    playDictationHudSound('recordingStart')
    store.setMode(mode)
    store.setPhase('recording')

    // Open the mic immediately so the HUD waveform and recorder share one live stream.
    const micWasWarm = isMicWarm()
    const micTimer = startDictationTimer('mic_open')
    const micPromise = ensureMic().then((stream) => {
      micTimer.mark(micWasWarm ? 'mic_reused_warm' : 'mic_opened')
      return stream
    })

    // Recording waits only on the mic, never on the foreground-app lookup.
    fillRecordingAppContext(foreground, sessionToken)
    dictationEngine.hadTextInputFocusAtCapture = snapshotTextInputFocusAtCapture(foreground)

    let media: MediaStream
    try {
      media = await micPromise
    } catch (err) {
      if (startAbandoned()) return
      store.setMode('idle')
      store.setPhase(null)
      // ensureMic already raised the OS / browser permission prompt when needed.
      store.setError(
        err instanceof Error && err.message
          ? err.message
          : 'Microphone access was denied. Check System Settings → Privacy & Security → Microphone.',
      )
      playDictationHudSound('error')
      resetHudAfter(isMicPermissionError(err) ? 4200 : 2800)
      return
    }
    if (startAbandoned()) {
      // Only release when idle - a newer session may already own this shared stream.
      if (!store.isRecording) releaseMic(true)
      return
    }
    restoreStartingSession(mode)
    attachMicMonitor(media)
    store.setAudioTrack(media.getAudioTracks()[0] ?? null)

    dictationEngine.chunks = []
    dictationEngine.startedAt = Date.now()

    dictationEngine.recorder = createMediaRecorder(media)
    dictationEngine.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) dictationEngine.chunks.push(event.data)
    }
    dictationEngine.recorder.start(RECORDER_TIMESLICE_MS)
    startLiveTranscription(media)
    armMaxDurationTimer(onMaxDurationReached)
  }

  /** Puts the text where the cursor was, then plays the success cue. */
  async function deliverText(text: string) {
    const pasteTimer = startPasteDictationTimer()
    store.setPhase('inserting')
    store.setPreviewText(text)
    const delivery = await resolveDictationDeliveryTarget()
    pasteTimer.mark(
      'target_resolved',
      `os=${delivery.osPasteTarget ? 'yes' : 'no'} stale=${delivery.staleDomTarget ? 'yes' : 'no'}`,
    )
    try {
      const result = await insertAtCursor(text, {
        osPasteTarget: delivery.osPasteTarget,
        staleDomTarget: delivery.staleDomTarget,
      })
      pasteTimer.mark(
        'insert_done',
        `ok=${result.ok} method=${result.method ?? 'none'}${result.reason ? ` reason=${result.reason}` : ''}`,
      )
    } catch {
      pasteTimer.mark('insert_failed')
      /* Paste is best-effort. The dictation is saved either way. */
    }
    playDictationHudSound('success')
    store.setPhase('done')
    resetHudAfter(200)
    pasteTimer.end('paste_done', `bytes=${text.length}`)
  }

  /** Keeps the recording of a dictation that did not finish, so it can be retried. */
  async function keepRecordingAudio(params?: {
    text?: string | null
    durationMs?: number | null
    speechDurationMs?: number | null
  }) {
    const retry = getDictationRetry()
    const durationMs = params?.durationMs ?? retry?.durationMs ?? null
    const speechDurationMs =
      params?.speechDurationMs ?? retry?.silenceContext?.speechDurationMs ?? null
    const pending = peekPendingCaptureAudio()
    if (!pending?.size) return
    try {
      const saved = await captures.persistPendingAudioCapture({
        id: retry?.captureId,
        text: params?.text ?? retry?.rawText,
        durationMs,
        speechDurationMs,
      })
      const captureId = saved?.capture?.id
      if (captureId && captureId !== retry?.captureId) {
        patchDictationRetry({ captureId })
      }
    } catch {
      /* keep the original dictation error */
    }
  }

  /** The transcript on this device: transcribe, save the capture, put the text in place. */
  async function processDictationFromCapture(
    payload: DictationRetryPayload,
    options: {
      timerLabel?: string
      /** Text transcribed while speaking; a null text means the full recording is needed. */
      liveTranscript?: Promise<LiveResult>
    } = {},
  ) {
    dictationEngine.finalizing = true
    if (!payload.captureId) {
      payload = { ...payload, captureId: crypto.randomUUID() }
    }
    dictationEngine.capturedAppContext = payload.capturedAppContext
    saveDictationRetry(payload)

    const timer = startDictationTimer(options.timerLabel ?? 'finalize')
    const { blob, mixedBlob, durationMs, silenceContext } = payload
    const playbackBlob = preferredPlaybackBlob(blob, null, mixedBlob ?? null)
    setPendingCaptureAudio(playbackBlob)

    store.setError(null)
    store.setMode('processing')
    store.setPhase('transcribing')
    await yieldToMainThread()
    if (options.timerLabel === 'retry') {
      playDictationHudSound('processingStart')
    }
    dictationEngine.abortController = new AbortController()

    try {
      if (!playbackBlob?.size) {
        markDictationFailed('No audio captured', timer)
        return
      }

      let sttText = ''
      let sttTiming = ''
      try {
        const live = options.liveTranscript ? await options.liveTranscript : null
        if (live) {
          timer.mark(
            'live_stt_done',
            `${live.timings.join(', ') || 'no segments'} | ${
              live.text === null ? 'full recording' : timingPreview(live.text)
            }`,
          )
        }
        if (live?.text != null) {
          sttText = live.text
        } else {
          const result = await transcribeGuestBlob(playbackBlob, {
            language: silenceContext.language,
            durationMs,
          })
          sttText = result.text
          sttTiming = result.timing ?? ''
        }
      } catch (err) {
        await keepRecordingAudio({ durationMs })
        markDictationFailed(
          err instanceof Error ? err.message : 'Local transcription failed',
          timer,
        )
        return
      }
      timer.mark(
        'stt_done',
        sttTiming ? `${sttTiming} | ${timingPreview(sttText)}` : timingPreview(sttText),
      )

      if (!sttText.trim() || shouldRejectDictationTranscript(sttText, silenceContext)) {
        await keepRecordingAudio({ durationMs })
        store.reset()
        timer.end('reject_transcript')
        return
      }

      const text = sttText.trim()
      const finalText = collapseRepeatedPhrases(text) || text
      patchDictationRetry({ stage: 'transcript', rawText: finalText })
      await captures.addCaptureLocal({
        id: retryCaptureId(),
        text: finalText,
        durationMs,
        speechDurationMs: silenceContext.speakingMs || null,
        source: 'hotkey',
      })
      await deliverText(finalText)
      timer.end('done')
    } catch (err) {
      await keepRecordingAudio({ durationMs })
      const message = dictationErrorMessage(err)
      const handledAsPermission = await markDictationFailedMaybePermission(err, message, timer)
      if (!handledAsPermission) {
        toast({
          title: 'Dictation didn’t finish',
          description: `${message} The recording was saved.`,
        })
      }
    } finally {
      dictationEngine.abortController = null
      dictationEngine.finalizing = false
      if (!store.error && !store.pasteFallbackText) {
        dictationEngine.capturedAppContext = null
        dictationEngine.capturedInsertTarget = null
      }
    }
  }

  async function finalizeRecording() {
    clearMaxDurationTimer()
    if (store.mode === 'idle' && !store.isRecording) return
    if (dictationEngine.finalizing) return
    dictationEngine.finalizing = true
    // Invalidate any in-flight startRecording continuation (quick tap: up during start awaits).
    dictationEngine.startToken++

    const durationMs = recordingElapsedMs()
    const micMonitor = dictationEngine.micMonitor
    const speechDurationMs = readSpeechDurationMs(micMonitor)
    const speakingMs = readSpeakingMs(micMonitor)
    const monitorSampled = readMonitorSampled(micMonitor)
    const timer = startDictationTimer('finalize')
    timer.mark(
      'key_release',
      `speech=${speechDurationMs}ms recording=${durationMs ?? 0}ms sampled=${monitorSampled}`,
    )

    // Accidental / silent holds: dismiss without flashing a spinner.
    // If the analyser actually ran, trust it - a long Option hold with no speech
    // is still silence. Only continue when the HUD never sampled (suspended context).
    if (
      speechDurationMs < MIN_DICTATION_SPEECH_MS &&
      (monitorSampled || (durationMs ?? 0) < MIN_DICTATION_HOLD_MS)
    ) {
      const recorderStopped = stopMediaRecorder()
      store.endRecordingSession()
      disposeMicMonitor()
      void (async () => {
        await recorderStopped
        scheduleWarmMicRelease(() => releaseMic(true))
        dictationEngine.capturedAppContext = null
        dictationEngine.capturedInsertTarget = null
        store.reset()
        dictationEngine.finalizing = false
        timer.end('silent_dismiss')
      })()
      return
    }

    // Leave recording chrome immediately on key release - do not wait on OS foreground snapshot.
    store.setAudioTrack(null)
    store.setMicWaveLevel(null)
    store.setPasteFallbackText(null)
    store.setMode('processing')
    store.setPhase('transcribing')
    // The key comes up on the last word, still on its way through the audio pipeline: keep
    // recording until it lands, or the end of the dictation is cut off.
    const trailingMs = await waitForTrailingSpeech(micMonitor, { measured: monitorSampled })
    timer.mark('trailing_speech', `${trailingMs}ms`)
    // Right away: the last words start transcribing while everything below runs. Before the
    // monitor goes, so the tail knows whether speech was heard in it.
    const liveTranscript = finishLiveTranscription()
    disposeMicMonitor()
    await yieldToMainThread()

    const [blob, foregroundAtRecordingEnd] = await Promise.all([
      stopMediaRecorder(),
      snapshotForegroundAtRecordingEnd(),
    ])
    dictationEngine.foregroundAtRecordingEnd = foregroundAtRecordingEnd
    timer.mark('recorder_stopped', `mic=${blob?.size ?? 0}B`)
    scheduleWarmMicRelease(() => releaseMic(true))

    const silenceContext = {
      speechDurationMs,
      speakingMs,
      recordingDurationMs: durationMs ?? 0,
      audioBytes: blob?.size ?? 0,
      language: resolveSttLanguage(voiceSettings.sttLanguage),
      monitorSampled,
    }

    if (!blob || shouldSkipDictationTranscription(silenceContext)) {
      store.reset()
      dictationEngine.finalizing = false
      timer.end('skip_transcription')
      return
    }

    timer.end('capture_ready')
    dictationEngine.finalizing = false

    await processDictationFromCapture(
      {
        stage: 'audio',
        blob,
        systemBlob: null,
        mixedBlob: null,
        durationMs,
        formatOn: false,
        capturedAppContext: dictationEngine.capturedAppContext,
        silenceContext,
      },
      { liveTranscript },
    )
  }

  async function retryLastDictation() {
    const cached = getDictationRetry()
    if (!cached || dictationEngine.finalizing || store.isRecording) return
    dictationEngine.finalizing = true
    await processDictationFromCapture(cached, { timerLabel: 'retry' })
  }

  function dismissDictationError() {
    if (store.isRecording) {
      store.setError(null)
      return
    }
    dictationEngine.capturedAppContext = null
    dictationEngine.capturedInsertTarget = null
    store.reset()
  }

  function cancelRecording() {
    clearMaxDurationTimer()
    const sessionToken = ++dictationEngine.startToken
    const keepAudio = Boolean(dictationEngine.finalizing && peekPendingCaptureAudio())
    const retry = getDictationRetry()
    const durationMs = retry?.durationMs ?? recordingElapsedMs()
    dictationEngine.abortController?.abort()
    dictationEngine.abortController = null
    dictationEngine.finalizing = false
    dictationEngine.capturedAppContext = null
    dictationEngine.capturedInsertTarget = null
    disposeMicMonitor()
    const recorderStopped = stopMediaRecorder()
    // A press can start a new session while this runs; the mic and HUD are then its own.
    const stillOurs = () => dictationEngine.startToken === sessionToken
    void recorderStopped.then(async () => {
      if (stillOurs()) releaseMic(true)
      if (keepAudio) {
        await keepRecordingAudio({ text: retry?.rawText, durationMs })
      } else {
        clearPendingCaptureAudio()
      }
      if (stillOurs()) store.reset()
    })
  }

  /** Cancel or finish the session now. Returns false: there is no confirmation step. */
  function requestEndRecording(kind: 'cancel' | 'finalize'): boolean {
    if (kind === 'cancel') cancelRecording()
    else void finalizeRecording()
    return false
  }

  /** Loads what dictation reads before the first key press. */
  function prefetchVoiceStores() {
    void voiceSettings.load()
  }

  return {
    startRecording,
    finalizeRecording,
    retryLastDictation,
    dismissDictationError,
    dismissPasteFallback,
    cancelRecording,
    requestEndRecording,
    patchRecordingForeground,
    prefetchVoiceStores,
    prewarmMicrophone,
  }
}
