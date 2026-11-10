import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { VoiceInsightsSummary } from '@/types/insights'
import { groupCapturesByDate } from '@/lib/voice/voiceCaptureGroups'
import { localTodayDateStr } from '@/lib/dateUtils'
import { computeDayStreak, localDateKeyFromIso } from '@/lib/voice/voiceStreak'
import { LOCAL_OWNER_ID } from '@/lib/localOwner'
import { notifyVoiceDataChanged } from '@/lib/voice/notifyVoiceDataChanged'
import { mirrorLocalEntity, openLocalStore, removeLocalEntity } from '@/lib/localStore/localStoreClient'
import { hydrateStoresFromLocalStore } from '@/lib/localStore/hydrateFromLocalStore'
import { buildGuestInsightsSummary, persistGuestInsightsSummary, readGuestInsightsSummary } from '@/lib/guestInsights'
import { deleteCaptureAudio, hasCaptureAudio, peekPendingCaptureAudio, putCaptureAudio, takePendingCaptureAudio } from '@/lib/voice/captureAudioStore'
import { isElectron } from '@/lib/platform/isElectron'
import { getVeennaDeviceId } from '@/lib/sync/deviceId'
import { detectCaptureChannel } from '@/lib/sync/captureChannel'
import { isListableVoiceCapture, untitledRecordingText } from '@/lib/voice/untitledRecording'
import { MIN_DICTATION_AUDIO_BYTES, MIN_PLACEHOLDER_DURATION_MS } from '@/lib/dictation/dictationSilence'
import { useCaptureAudioWatch } from '@/lib/voice/captures/useCaptureAudioWatch'
import { readCache, writeCache } from '@/lib/voice/captures/captureCache'
import { computeAverageWpm, countWords } from '@/lib/voice/captures/captureStats'
import { captureMatchesQuery } from '@/lib/voice/captures/captureQuery'
import type { VoiceCapture, VoiceCaptureGroup, VoiceCapturesHistoryPage } from '@/lib/voice/captures/types'

export type { VoiceCapture, VoiceCaptureGroup, VoiceCapturesHistoryPage }


export const useVoiceCapturesStore = defineStore('voiceCaptures', () => {
  const cached = readCache()
  const captures = ref<VoiceCapture[]>(cached.captures)
  const insights = ref<VoiceInsightsSummary | null>(cached.insights)
  const syncing = ref(false)
  const synced = ref(false)
  /**
   * First cloud (or local-only) look for this session finished. Home activity
   * waits on this so cached partials do not flash before the full summary.
   */
  const initialCloudSyncSettled = ref(false)
  const syncError = ref<string | null>(null)
  const historyError = ref<string | null>(null)
  const historyPage = ref<VoiceCapturesHistoryPage>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
    query: '',
    loading: false,
    loaded: false,
  })
  /** After first dictation history attempt with data, never show the full-page skeleton again. */
  const historyBootstrapComplete = ref(false)
  /**
   * The app has looked for captures at least once this session - local disk,
   * cloud, or a cache that already had rows. Until then "nothing here yet" is a
   * guess, so the feed waits rather than claiming the list is empty.
   */
  const capturesChecked = ref(cached.captures.length > 0 || Boolean(cached.insights))
  /**
   * The local-disk read for this session has finished (or was never needed).
   * `capturesChecked` can already be true from a cached insights summary while
   * the rows themselves are still coming off disk - the feed would claim "no
   * captures today" in that window. This says whether the rows have landed.
   */
  const localCapturesHydrated = ref(cached.captures.length > 0)
  const historyRevalidating = ref(false)
  /** Capture ids currently writing audio to IndexedDB (background only). */
  let historyFetchSeq = 0

  const { audioSavingIds, isAudioSaving, setAudioSaving, watchCaptureAudio, stopWatchingCaptureAudio } =
    useCaptureAudioWatch({
      hasAudio: (id) => Boolean(captures.value.find((item) => item.id === id)?.hasAudio),
      markHasAudio: (id) => markCaptureHasAudio(id),
    })

  function completeHistoryBootstrap() {
    historyBootstrapComplete.value = true
  }

  function maybeCompleteHistoryBootstrap() {
    if (historyPage.value.items.length > 0 || captures.value.length > 0) {
      completeHistoryBootstrap()
    }
  }

  if (captures.value.length > 0 || (insights.value?.totalCaptures ?? 0) > 0) {
    completeHistoryBootstrap()
  }

  const totalWords = computed(() => {
    if (insights.value && (insights.value.totalCaptures > 0 || insights.value.totalWords > 0)) {
      return insights.value.totalWords
    }
    return captures.value.reduce((sum, item) => sum + (item.wordCount || countWords(item.text)), 0)
  })

  const totalCaptures = computed(() => {
    const fromInsights = insights.value?.totalCaptures
    const fromLocal = captures.value.length
    if (fromInsights == null) return fromLocal
    // Insights is the server total; local cache is only the recent page.
    return Math.max(fromInsights, fromLocal)
  })

  const dayStreak = computed(() => {
    if (insights.value && (insights.value.totalCaptures > 0 || insights.value.dayStreak > 0)) {
      return insights.value.dayStreak
    }
    if (!captures.value.length) return 0
    const activeDays = captures.value.map((item) => localDateKeyFromIso(item.createdAt))
    return computeDayStreak(activeDays, localTodayDateStr())
  })

  const averageWpm = computed(() => {
    if (insights.value && insights.value.averageWpm > 0) return insights.value.averageWpm
    return computeAverageWpm(captures.value) || insights.value?.averageWpm || 0
  })

  function persistLocal() {
    writeCache(captures.value, insights.value)
  }

  /** Takes a summary that came with another response (the Insights page's one call). */
  function applyInsightsSummary(summary: VoiceInsightsSummary) {
    insights.value = summary
    persistLocal()
  }

  /** The stats are worked out from the dictations on this device. */
  async function refreshInsights() {
    insights.value = buildGuestInsightsSummary(captures.value)
    persistLocal()
    void persistGuestInsightsSummary(captures.value)
  }



  function markCaptureHasAudio(id: string) {
    let changed = false
    captures.value = captures.value.map((item) => {
      if (item.id !== id || item.hasAudio) return item
      changed = true
      return { ...item, hasAudio: true }
    })
    if (historyPage.value.items.some((item) => item.id === id)) {
      historyPage.value = {
        ...historyPage.value,
        items: historyPage.value.items.map((item) =>
          item.id === id && !item.hasAudio ? { ...item, hasAudio: true } : item,
        ),
      }
      changed = true
    }
    if (changed) persistLocal()
    return captures.value.find((item) => item.id === id) ?? null
  }


  /** Probe IndexedDB and flip hasAudio for captures that already have files on disk. */
  async function reconcileCaptureAudioFlags(ids?: string[]) {
    const targets = ids?.length
      ? ids
      : captures.value
          .filter((item) => !item.hasAudio)
          .slice(0, 40)
          .map((item) => item.id)
    if (!targets.length) return

    await Promise.all(
      targets.map(async (id) => {
        try {
          if (await hasCaptureAudio(id)) markCaptureHasAudio(id)
        } catch {
          /* ignore per-id probe failures */
        }
      }),
    )
  }

  async function attachPendingAudio(captureId: string, blobOverride?: Blob | null) {
    const blob = blobOverride && blobOverride.size > 0 ? blobOverride : takePendingCaptureAudio()
    if (blobOverride && peekPendingCaptureAudio() === blobOverride) {
      takePendingCaptureAudio()
    }
    if (!blob || !captureId) {
      setAudioSaving(captureId, false)
      notifyVoiceDataChanged({ audioSaving: false, audioCaptureId: captureId })
      return
    }
    try {
      await putCaptureAudio(captureId, blob)
      const ready = await hasCaptureAudio(captureId)
      if (!ready) {
        notifyVoiceDataChanged({ audioSaving: false, audioCaptureId: captureId })
        return
      }
      const updated = markCaptureHasAudio(captureId)
      notifyVoiceDataChanged({
        audioSaving: false,
        audioCaptureId: captureId,
        ...(updated?.id ? { capture: { ...updated, hasAudio: true } } : {}),
      })
    } catch {
      notifyVoiceDataChanged({ audioSaving: false, audioCaptureId: captureId })
    } finally {
      setAudioSaving(captureId, false)
    }
  }



  /** Fire-and-forget audio persist. Never blocks dictation / paste / UI. */
  function queueAttachPendingAudio(captureId: string, blob?: Blob | null) {
    const audio = blob && blob.size > 0 ? blob : peekPendingCaptureAudio()
    if (!captureId || !audio?.size) return
    setAudioSaving(captureId, true)
    const snapshot = captures.value.find((item) => item.id === captureId)
    notifyVoiceDataChanged({
      audioSaving: true,
      audioCaptureId: captureId,
      ...(snapshot ? { capture: { ...snapshot, hasAudio: false } } : {}),
    })
    void attachPendingAudio(captureId, audio)
  }

  function upsertCaptureOptimistic(capture: VoiceCapture) {
    const prior = captures.value.find((item) => item.id === capture.id)
    const next: VoiceCapture = {
      ...capture,
      createdAt: prior?.createdAt ?? capture.createdAt,
      // Never drop a known-local audio flag when another window upserts the transcript.
      hasAudio: Boolean(capture.hasAudio || prior?.hasAudio),
      originDeviceId: capture.originDeviceId ?? prior?.originDeviceId ?? null,
      originChannel: capture.originChannel ?? prior?.originChannel ?? null,
    }
    captures.value = [next, ...captures.value.filter((item) => item.id !== next.id)]
    const hist = historyPage.value
    const existsInHistory = hist.items.some((item) => item.id === next.id)
    if (existsInHistory) {
      historyPage.value = {
        ...hist,
        items: hist.items.map((item) =>
          item.id === next.id ? { ...item, ...next, hasAudio: next.hasAudio } : item,
        ),
      }
    } else if (hist.page === 1 && captureMatchesQuery(next, hist.query)) {
      historyPage.value = {
        ...hist,
        items: [next, ...hist.items].slice(0, hist.pageSize),
        total: Math.max(hist.total + 1, captures.value.length),
        loaded: true,
        loading: false,
      }
    }
    completeHistoryBootstrap()
    persistLocal()
    mirrorLocalEntity(
      'voice_capture',
      next.id,
      next as unknown as Record<string, unknown>,
      next.createdAt,
    )
    // Only the window that still holds the recording blob should attach it.
    queueAttachPendingAudio(next.id)
    if (next.hasAudio) {
      setAudioSaving(next.id, false)
      stopWatchingCaptureAudio(next.id)
    } else if (!peekPendingCaptureAudio()) {
      // Main window: HUD is likely still writing - poll until IndexedDB has the file.
      watchCaptureAudio(next.id)
    }
  }










  function snapshotPendingAudio(): Blob | null {
    const blob = peekPendingCaptureAudio()
    return blob && blob.size > 0 ? blob : null
  }

  function captureDisplayText(
    payload: {
      text?: string | null
      durationMs?: number | null
    },
    audio: Blob | null,
  ): string {
    const trimmed = (payload.text ?? '').trim()
    if (trimmed) return trimmed
    if (!audio?.size) return ''
    return untitledRecordingText(payload.durationMs)
  }

  function findCapture(id: string | null | undefined): VoiceCapture | undefined {
    if (!id) return undefined
    return (
      captures.value.find((item) => item.id === id) ||
      historyPage.value.items.find((item) => item.id === id)
    )
  }

  async function addCaptureLocal(payload: {
    id?: string | null
    text: string
    durationMs?: number | null
    speechDurationMs?: number | null
    source?: VoiceCapture['source']
  }) {
    const pendingAudio = snapshotPendingAudio()
    const displayText = captureDisplayText(payload, pendingAudio)
    if (!displayText) return null

    const existing = findCapture(payload.id)
    const entry: VoiceCapture = {
      id: payload.id || existing?.id || crypto.randomUUID(),
      text: (payload.text || '').trim() || displayText,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: existing ? new Date().toISOString() : undefined,
      wordCount: countWords(displayText),
      durationMs: payload.durationMs ?? existing?.durationMs ?? null,
      speechDurationMs: payload.speechDurationMs ?? existing?.speechDurationMs ?? null,
      source: payload.source ?? existing?.source ?? 'dictation',
      hasAudio: existing?.hasAudio,
      originDeviceId: existing?.originDeviceId ?? getVeennaDeviceId(),
      originChannel: existing?.originChannel ?? detectCaptureChannel(),
    }
    captures.value = [entry, ...captures.value.filter((item) => item.id !== entry.id)]
    persistLocal()
    mirrorLocalEntity(
      'voice_capture',
      entry.id,
      entry as unknown as Record<string, unknown>,
      entry.createdAt,
    )
    notifyVoiceDataChanged({ capture: entry })
    queueAttachPendingAudio(entry.id, pendingAudio)
    const summary = await persistGuestInsightsSummary(captures.value)
    insights.value = summary
    return { capture: entry, note: null }
  }


  /** Keep the recording even when transcription or formatting fails. */
  async function persistPendingAudioCapture(payload: {
    id?: string | null
    text?: string | null
    durationMs?: number | null
    speechDurationMs?: number | null
    source?: VoiceCapture['source']
  }) {
    const existing = findCapture(payload.id)
    if (existing) return { capture: existing, note: null }
    const audio = snapshotPendingAudio()
    if (!audio || audio.size < MIN_DICTATION_AUDIO_BYTES) return null
    if ((payload.durationMs ?? 0) < 250) return null
    const transcript = (payload.text || '').trim()
    const tooShortForPlaceholder =
      !transcript && (payload.durationMs ?? 0) < MIN_PLACEHOLDER_DURATION_MS
    if (tooShortForPlaceholder) return null
    const text = transcript || untitledRecordingText(payload.durationMs)
    return addCaptureLocal({
      id: payload.id || undefined,
      text,
      durationMs: payload.durationMs ?? null,
      speechDurationMs: payload.speechDurationMs ?? null,
      source: payload.source ?? 'dictation',
    })
  }




  function applyCapturePatch(id: string, patch: Partial<VoiceCapture>) {
    const merge = (item: VoiceCapture): VoiceCapture => {
      if (item.id !== id) return item
      const next = { ...item, ...patch }
      const display = next.text.trim()
      next.wordCount = countWords(display)
      return next
    }

    captures.value = captures.value.map(merge)
    if (historyPage.value.items.some((item) => item.id === id)) {
      historyPage.value = {
        ...historyPage.value,
        items: historyPage.value.items.map(merge),
      }
    }

    const updated =
      captures.value.find((item) => item.id === id) ||
      historyPage.value.items.find((item) => item.id === id)
    if (updated) {
      persistLocal()
      mirrorLocalEntity(
        'voice_capture',
        updated.id,
        updated as unknown as Record<string, unknown>,
        updated.createdAt,
      )
      notifyVoiceDataChanged({ capture: updated })
    }
    return updated ?? null
  }

  async function patchCapture(
    id: string,
    payload: {
      text?: string
    },
  ) {
    const current =
      captures.value.find((item) => item.id === id) ||
      historyPage.value.items.find((item) => item.id === id)
    if (!current) return null

    const optimistic: Partial<VoiceCapture> = {}
    if (payload.text !== undefined) optimistic.text = payload.text.trim()

    const local = applyCapturePatch(id, {
      ...optimistic,
      hasAudio: current.hasAudio,
    })

    return local
  }

  function removeCaptureLocal(id: string) {
    setAudioSaving(id, false)
    stopWatchingCaptureAudio(id)
    captures.value = captures.value.filter((item) => item.id !== id)

    if (historyPage.value.loaded || historyPage.value.items.length) {
      const removedFromHistory = historyPage.value.items.some((item) => item.id === id)
      historyPage.value = {
        ...historyPage.value,
        items: historyPage.value.items.filter((item) => item.id !== id),
        total: removedFromHistory
          ? Math.max(0, historyPage.value.total - 1)
          : historyPage.value.total,
      }
    }

    persistLocal()
    removeLocalEntity('voice_capture', id)
    void deleteCaptureAudio(id)
  }

  async function removeCapture(id: string) {
    removeCaptureLocal(id)
    await refreshInsights()
  }

  function groupedCaptures(query = '', limit?: number): VoiceCaptureGroup[] {
    const q = query.trim().toLowerCase()
    let filtered = captures.value.filter((item) => {
      if (!isListableVoiceCapture(item)) return false
      if (!q) return true
      const haystack = item.text.toLowerCase()
      return haystack.includes(q)
    })
    if (limit != null && limit > 0) {
      filtered = filtered.slice(0, limit)
    }
    return groupCapturesByDate(filtered)
  }


  function filteredLocalCaptures(query: string): VoiceCapture[] {
    return captures.value.filter(
      (item) => isListableVoiceCapture(item) && captureMatchesQuery(item, query),
    )
  }




  async function ensureLocalCapturesHydrated() {
    if (captures.value.length) {
      localCapturesHydrated.value = true
      return
    }
    if (!isElectron) {
      localCapturesHydrated.value = true
      return
    }
    // `finally`, not a trailing assignment: a disk read that throws must still
    // release the feed's skeleton, or the list shimmers forever.
    try {
      await openLocalStore(LOCAL_OWNER_ID)

      await hydrateStoresFromLocalStore()
      await hydrateGuestInsights()

      if (!insights.value && captures.value.length) {
        insights.value = buildGuestInsightsSummary(captures.value)
        persistLocal()
        void persistGuestInsightsSummary(captures.value)
      }

      if (captures.value.length || (insights.value?.totalCaptures ?? 0) > 0) {
        synced.value = true
        syncError.value = null
      }
      capturesChecked.value = true
      initialCloudSyncSettled.value = true
    } finally {
      localCapturesHydrated.value = true
    }
  }

  function applyLocalHistoryPage(options: { page: number; pageSize: number; query?: string }) {
    const query = options.query?.trim() ?? ''
    const filtered = filteredLocalCaptures(query)
    const total = filtered.length
    const start = (options.page - 1) * options.pageSize
    const items = filtered.slice(start, start + options.pageSize)
    historyPage.value = {
      items,
      total,
      page: options.page,
      pageSize: options.pageSize,
      query,
      loading: false,
      loaded: true,
    }
    historyError.value = null
    completeHistoryBootstrap()
  }

  async function loadLocalHistoryPage(options: { page: number; pageSize: number; query?: string }) {
    await ensureLocalCapturesHydrated()
    applyLocalHistoryPage(options)
  }

  async function hydrateGuestInsights() {
    const summary = await readGuestInsightsSummary()
    if (summary) insights.value = summary
  }

  async function loadHistoryPage(options: { page: number; pageSize: number; query?: string }) {
    const query = options.query?.trim() ?? ''
    const seq = ++historyFetchSeq
    historyError.value = null
    if (
      !historyBootstrapComplete.value &&
      !historyPage.value.items.length &&
      !captures.value.length
    ) {
      historyPage.value = {
        ...historyPage.value,
        page: options.page,
        pageSize: options.pageSize,
        query,
        loading: true,
      }
    }
    try {
      await loadLocalHistoryPage(options)
    } catch (err) {
      if (seq !== historyFetchSeq) return
      historyError.value = err instanceof Error ? err.message : 'Could not load local captures.'
      historyPage.value = {
        items: [],
        total: 0,
        page: options.page,
        pageSize: options.pageSize,
        query,
        loading: false,
        loaded: false,
      }
      maybeCompleteHistoryBootstrap()
    }
  }

  function applySqliteHydration(nextCaptures: VoiceCapture[]) {
    if (!nextCaptures.length) return
    captures.value = [...nextCaptures].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    )
    synced.value = true
    maybeCompleteHistoryBootstrap()
    if (historyPage.value.loaded && !historyPage.value.items.length && captures.value.length) {
      applyLocalHistoryPage({
        page: historyPage.value.page,
        pageSize: historyPage.value.pageSize,
        query: historyPage.value.query,
      })
    }
  }

  return {
    captures,
    insights,
    syncing,
    synced,
    initialCloudSyncSettled,
    syncError,
    historyError,
    historyPage,
    historyBootstrapComplete,
    capturesChecked,
    localCapturesHydrated,
    historyRevalidating,
    audioSavingIds,
    isAudioSaving,
    setAudioSaving,
    watchCaptureAudio,
    reconcileCaptureAudioFlags,
    totalWords,
    totalCaptures,
    dayStreak,
    averageWpm,
    refreshInsights,
    applyInsightsSummary,
    applySqliteHydration,
    addCaptureLocal,
    persistPendingAudioCapture,
    hydrateGuestInsights,
    ensureLocalCapturesHydrated,
    upsertCaptureOptimistic,
    patchCapture,
    removeCapture,
    removeCaptureLocal,
    groupedCaptures,
    filterHistoryLocally: applyLocalHistoryPage,
    loadHistoryPage,
  }
})
