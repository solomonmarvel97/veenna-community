<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { format, isToday, parseISO } from 'date-fns'
import { PhCaretDown, PhCheck, PhCopy, PhMagicWand, PhMagnifyingGlass, PhStop, PhSpinner } from '@phosphor-icons/vue'
import { useRouter } from 'vue-router'
import { transcribeGuestBlob } from '@/lib/voice/localStt'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { groupCapturesByDate } from '@/lib/voice/voiceCaptureGroups'
import { writeClipboardText } from '@/lib/clipboard/writeClipboardText'
import { isListableVoiceCapture } from '@/lib/voice/untitledRecording'
import { CaptureAudioDownloadError, captureHasPlayableAudio, ensureCaptureAudioLocal } from '@/lib/voice/captureAudio'
import { useVoiceCapturesStore } from '@/stores/voiceCaptures'
import type { VoiceCapture, VoiceCaptureGroup } from '@/stores/voiceCaptures'
import { useToast } from '@/components/ui/toast/use-toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState, SearchField, SectionHeading, VeennaButton } from '@/components/veenna'
import DictationDetailModal, {
  type DictationDetailActions,
} from '@/components/voice/DictationDetailModal.vue'
import { confirm } from '@/composables/useConfirmDialog'
import { veennaUi } from '@/lib/veennaUi'
import DictationEmptyState from '@/components/dictation/DictationEmptyState.vue'
import { QUERY } from '@/router/paths'
import VoiceCaptureFeedSkeleton from '@/components/skeleton/VoiceCaptureFeedSkeleton.vue'
import { useErrorToast } from '@/composables/useMessageToast'

const PREVIEW_PAGE_SIZE_OPTIONS = [5, 10, 20]

const HISTORY_PERIOD_OPTIONS = [
  { id: 'all', label: 'All time', days: null as number | null },
  { id: '7', label: '7 days', days: 7 },
  { id: '30', label: '30 days', days: 30 },
  { id: '90', label: '90 days', days: 90 },
] as const

type HistoryPeriodId = (typeof HISTORY_PERIOD_OPTIONS)[number]['id']

const props = withDefaults(
  defineProps<{
    mode?: 'preview' | 'full'
    /** Open this capture's detail panel when set (from `?capture=` deep links). */
    focusCaptureId?: string | null
    /** Centre the empty state in the whole pane (nothing else sits on the page but the hero above). */
    centerEmpty?: boolean
  }>(),
  { mode: 'preview', centerEmpty: false },
)

const store = useVoiceCapturesStore()
const router = useRouter()
const { toast } = useToast()

const query = ref('')
const debouncedQuery = ref('')
const copiedId = ref<string | null>(null)
const detailCopyFeedback = ref(false)
const deletingId = ref<string | null>(null)
type CaptureRowAction = 'retry'
const rowActionById = ref<Record<string, CaptureRowAction>>({})
const detailOpen = ref(false)
const viewing = ref<VoiceCapture | null>(null)
const playingId = ref<string | null>(null)
const playLoadingId = ref<string | null>(null)

let playbackAudio: HTMLAudioElement | null = null
let playbackObjectUrl: string | null = null

/**
 * Ceiling on the preview shimmer. The first look can stay outstanding for a
 * long time when a Talk session defers the sync, and an endless shimmer is a
 * worse lie than an empty state - past this the feed shows what it knows.
 */
const PREVIEW_FIRST_LOOK_CEILING_MS = 8000
const firstLookExpired = ref(false)
let firstLookTimer: ReturnType<typeof setTimeout> | null = null

const page = ref(1)
const pageSize = ref(10)
const historyPeriod = ref<HistoryPeriodId>('7')

const historyPeriodDays = computed(
  () => HISTORY_PERIOD_OPTIONS.find((option) => option.id === historyPeriod.value)?.days ?? null,
)

function captureWithinPeriod(item: VoiceCapture) {
  const days = historyPeriodDays.value
  if (!days) return true
  const created = Date.parse(item.createdAt)
  if (!Number.isFinite(created)) return true
  return created >= Date.now() - days * 24 * 60 * 60 * 1000
}

let copiedTimer: ReturnType<typeof setTimeout> | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const isFull = computed(() => props.mode === 'full')

const listShellClass = 'space-y-4 sm:space-y-6'

const groupSectionClass = 'space-y-2'

// Cards stay solid bg-card so the Copy control's bg-muted reads as a chip.
// Avoid opacity on --veenna-row / --veenna-panel: those are already translucent
// and often disappear on wallpaper.
const itemClass = 'overflow-hidden rounded-md border border-veenna-divider bg-card'

function groupHeaderClass(period: VoiceCaptureGroup['period']) {
  if (period === 'today') {
    return 'py-2 text-body font-medium text-veenna-fg'
  }
  if (period === 'yesterday') {
    return 'py-2.5 text-label font-medium uppercase tracking-overline text-veenna-muted'
  }
  return 'py-2.5 text-label font-medium uppercase tracking-overline text-veenna-muted/70'
}

const showHistorySkeleton = computed(
  () =>
    isFull.value &&
    !store.historyBootstrapComplete &&
    loading.value &&
    !store.historyPage.items.length &&
    !store.captures.length &&
    !store.historyError,
)

const previewFiltered = computed(() => {
  const todays = store.captures.filter(
    (item) => isListableVoiceCapture(item) && isToday(parseISO(item.createdAt)),
  )
  const q = query.value.trim().toLowerCase()
  if (!q) return todays
  return todays.filter((item) => {
    const haystack = item.text.toLowerCase()
    return haystack.includes(q)
  })
})

const previewTotal = computed(() => previewFiltered.value.length)

/**
 * Show the skeleton until the first look for captures finishes - not just while
 * a request happens to be in flight. Before that, an empty list is unknown, not
 * a fact, and rendering "nothing yet" made a full history look empty on open.
 *
 * Three separate waits, because each one used to leak a different wrong frame:
 * the disk read can still be running while a cached insights summary has
 * already flipped `capturesChecked` ("No captures today" over rows that were
 * about to land); the first cloud look may not have happened at all; and a sync
 * that is still in flight with nothing hydrated fell through every branch and
 * rendered an empty list shell - a bare gap where the feed belongs.
 */
const showPreviewSkeleton = computed(() => {
  if (isFull.value) return false
  // Never cover rows we can already show.
  if (previewTotal.value) return false
  if (firstLookExpired.value) return false
  if (!store.localCapturesHydrated) return true
  if (!store.capturesChecked) return true
  return store.syncing && !store.synced && !store.captures.length
})

const previewPageItems = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return previewFiltered.value.slice(start, start + pageSize.value)
})

const previewGroups = computed(() => groupCapturesByDate(previewPageItems.value))

const fullFilteredHistoryItems = computed(() =>
  store.historyPage.items.filter(
    (item) => isListableVoiceCapture(item) && captureWithinPeriod(item),
  ),
)

const fullFallbackCaptures = computed(() =>
  store.captures.filter((item) => isListableVoiceCapture(item) && captureWithinPeriod(item)),
)

const fullGroups = computed(() => {
  if (fullFilteredHistoryItems.value.length) {
    return groupCapturesByDate(fullFilteredHistoryItems.value)
  }
  if (!debouncedQuery.value.trim() && fullFallbackCaptures.value.length && page.value === 1) {
    return groupCapturesByDate(fullFallbackCaptures.value.slice(0, pageSize.value))
  }
  return groupCapturesByDate(fullFilteredHistoryItems.value)
})

const groups = computed(() => (isFull.value ? fullGroups.value : previewGroups.value))

const showHistoryRefreshing = computed(
  () => isFull.value && store.historyRevalidating && groups.value.length > 0,
)

const loading = computed(() => isFull.value && store.historyPage.loading)

const total = computed(() => {
  if (!isFull.value) return previewTotal.value
  const days = historyPeriodDays.value
  if (days != null) {
    return groups.value.reduce((sum, group) => sum + group.items.length, 0)
  }
  const historyTotal = store.historyPage.total
  if (!debouncedQuery.value.trim() && store.captures.length > historyTotal) {
    return store.captures.length
  }
  return historyTotal
})

const showPagination = computed(() => total.value > pageSize.value)

const showEmpty = computed(() => {
  if (isFull.value) {
    if (loading.value) return false
    if (store.historyError) return false
    if (groups.value.length > 0) return false
    if (
      !debouncedQuery.value.trim() &&
      historyPeriodDays.value == null &&
      store.captures.length > 0
    ) {
      return false
    }
    return store.historyPage.loaded && total.value === 0
  }
  // Empty is a claim, and the skeleton owns every state where we cannot make it
  // yet - disk still reading, first look outstanding, sync in flight with
  // nothing hydrated. Anything it does not cover is something we actually know.
  if (showPreviewSkeleton.value) return false
  return !previewTotal.value
})

/** Nothing recorded at all, as opposed to nothing matching the search, period or today. */
const hasNoDictations = computed(
  () =>
    !query.value.trim() &&
    !store.captures.length &&
    !store.totalCaptures &&
    !store.historyPage.total,
)

const emptyHeading = computed(() => {
  if (hasNoDictations.value) return undefined
  return isFull.value ? 'No dictations in this time range' : 'No dictations today'
})

const showDictationEmpty = computed(() => showEmpty.value && !query.value.trim())

/**
 * The empty state fills the room under the hero and centres in it. The hero sits above that room,
 * so the state reaches up over it by the hero's height (less the page's own padding) to land the
 * figure on the pane's middle rather than the middle of what is left. A margin, not padding: it
 * adds no height, so a small window never grows a scrollbar to make room for it. It is lifted
 * above the hero (a positioned layer that would otherwise paint over the figure's top) because in
 * a short window the centred figure reaches up into the hero's area.
 */
const centersEmpty = computed(() => props.centerEmpty && showDictationEmpty.value)

/** What the open dictation can do right now: the row menu's own rules, handed to the detail modal. */
const detailActions = computed<DictationDetailActions>(() => {
  const item = viewing.value
  const none: DictationDetailActions = {
    canPlay: false,
    playing: false,
    playLoading: false,
    audioPendingLabel: null,
    canRetry: false,
  }
  if (!item) return none
  const hasAudio = captureHasPlayableAudio(item)
  const audioReady = hasAudio && !store.isAudioSaving(item.id)
  return {
    canPlay: hasAudio,
    playing: playingId.value === item.id,
    playLoading: playLoadingId.value === item.id,
    audioPendingLabel: null,
    canRetry: audioReady,
  }
})

const detailTitle = computed(() => {
  const item = viewing.value
  if (!item) return 'Capture'
  return timeLabel(item.createdAt)
})

function formatDuration(ms: number) {
  const totalSec = Math.round(ms / 1000)
  if (totalSec < 60) return `${totalSec}s`
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  return secs ? `${mins}m ${secs}s` : `${mins}m`
}

function rowAction(item: VoiceCapture): CaptureRowAction | null {
  return rowActionById.value[item.id] ?? null
}

function isRowBusy(item: VoiceCapture) {
  return deletingId.value === item.id || rowAction(item) != null
}

function markRowAction(id: string, action: CaptureRowAction) {
  rowActionById.value = { ...rowActionById.value, [id]: action }
}

function clearRowAction(id: string, action: CaptureRowAction) {
  if (rowActionById.value[id] !== action) return
  const next = { ...rowActionById.value }
  delete next[id]
  rowActionById.value = next
}

function syncViewing(item: VoiceCapture | null) {
  if (!item) return
  if (viewing.value?.id === item.id) viewing.value = item
}

async function retryTranscript(item: VoiceCapture) {
  if (!captureHasPlayableAudio(item) || isRowBusy(item)) return
  markRowAction(item.id, 'retry')
  try {
    const blob = await ensureCaptureAudioLocal(item)
    if (!blob) {
      toast({ title: 'Audio unavailable for retry', variant: 'destructive' })
      return
    }

    const rawText = (
      await transcribeGuestBlob(blob, { durationMs: item.durationMs ?? null })
    ).text.trim()

    if (!rawText) {
      toast({ title: 'No speech detected', variant: 'destructive' })
      return
    }

    const updated = await store.patchCapture(item.id, { text: rawText })
    syncViewing(updated)
    toast({ title: 'Transcript updated' })
  } catch {
    toast({ title: 'Could not retry transcript', variant: 'destructive' })
  } finally {
    clearRowAction(item.id, 'retry')
  }
}

function timeLabel(iso: string) {
  return format(parseISO(iso), 'h:mm a').toLowerCase()
}

function openDetail(item: VoiceCapture) {
  viewing.value = findCaptureById(item.id) || item
  detailOpen.value = true
  detailCopyFeedback.value = false
}

function closeDetail() {
  detailOpen.value = false
  viewing.value = null
  detailCopyFeedback.value = false
}

function stopPlayback() {
  if (playbackAudio) {
    playbackAudio.pause()
    playbackAudio.src = ''
    playbackAudio = null
  }
  if (playbackObjectUrl) {
    URL.revokeObjectURL(playbackObjectUrl)
    playbackObjectUrl = null
  }
  playingId.value = null
  playLoadingId.value = null
}

async function togglePlayback(item: VoiceCapture) {
  if (!captureHasPlayableAudio(item) || store.isAudioSaving(item.id)) return
  if (playingId.value === item.id) {
    stopPlayback()
    return
  }

  stopPlayback()
  playLoadingId.value = item.id
  try {
    const blob = await ensureCaptureAudioLocal(item)
    if (!blob) {
      playLoadingId.value = null
      toast({
        title: 'Audio unavailable',
        variant: 'destructive',
      })
      return
    }

    if (!item.hasAudio) {
      store.reconcileCaptureAudioFlags([item.id])
    }

    playbackObjectUrl = URL.createObjectURL(blob)
    const audio = new Audio(playbackObjectUrl)
    playbackAudio = audio
    audio.onended = () => stopPlayback()
    audio.onerror = () => stopPlayback()
    playingId.value = item.id
    playLoadingId.value = null
    await audio.play()
  } catch (error) {
    stopPlayback()
    if (error instanceof CaptureAudioDownloadError) {
      toast({
        title: 'Could not download the audio',
        description: 'Check your connection and try again.',
        variant: 'destructive',
      })
      return
    }
    toast({
      title: 'Could not play capture',
      description: 'This device could not play the recording.',
      variant: 'destructive',
    })
  }
}

function scheduleCopyFeedback(itemId: string, showDetailFeedback: boolean) {
  if (showDetailFeedback) detailCopyFeedback.value = true
  copiedId.value = itemId
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    detailCopyFeedback.value = false
    if (copiedId.value === itemId) copiedId.value = null
    copiedTimer = null
  }, 2000)
}

async function copyFromDetail(shown: string) {
  if (!viewing.value) return
  const item = viewing.value
  const text = shown.trim() || item.text.trim()
  if (!text) return

  detailCopyFeedback.value = true
  const ok = await writeClipboardText(text)
  if (!ok) {
    detailCopyFeedback.value = false
    toast({ title: 'Could not copy the capture', variant: 'destructive' })
    return
  }

  scheduleCopyFeedback(item.id, true)
  toast({ title: 'Capture copied' })
}

async function copyCapture(item: VoiceCapture) {
  const text = item.text.trim()
  if (!text) return

  const ok = await writeClipboardText(text)
  if (!ok) {
    toast({ title: 'Could not copy the capture', variant: 'destructive' })
    return
  }

  scheduleCopyFeedback(item.id, viewing.value?.id === item.id)
  toast({ title: 'Capture copied' })
}

function capturePreview(text: string, max = 80) {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max).trim()}…`
}

async function confirmDeleteCapture(item: VoiceCapture) {
  const text = item.text.trim()
  const preview = capturePreview(text)

  const ok = await confirm({
    title: 'Delete this capture?',
    description: preview
      ? `"${preview}" will be removed from your dictation history.`
      : 'This capture will be removed from your dictation history.',
    confirmLabel: 'Delete',
    destructive: true,
  })
  if (!ok) return

  deletingId.value = item.id
  try {
    await store.removeCapture(item.id)

    if (viewing.value?.id === item.id) {
      closeDetail()
    }

    if (
      isFull.value &&
      store.historyPage.loaded &&
      store.historyPage.items.length === 0 &&
      page.value > 1
    ) {
      page.value -= 1
    }
    if (isFull.value) {
      loadFullPage()
    }
  } finally {
    if (deletingId.value === item.id) deletingId.value = null
  }
}

function syncPaginationFromStore() {
  page.value = store.historyPage.page
  pageSize.value = store.historyPage.pageSize
  debouncedQuery.value = store.historyPage.query
  query.value = store.historyPage.query
}

async function loadPreviewFeed() {
  // Desktop keeps captures on disk, not in localStorage.
  await store.ensureLocalCapturesHydrated()
}

function loadFullPage() {
  void store.loadHistoryPage({
    page: page.value,
    pageSize: pageSize.value,
    query: debouncedQuery.value,
  })
}

function clampPreviewPage() {
  const maxPage = Math.max(1, Math.ceil(previewTotal.value / pageSize.value) || 1)
  if (page.value > maxPage) page.value = maxPage
}

function onPageChange(next: number) {
  page.value = next
  if (isFull.value) loadFullPage()
}

function onPageSizeChange(size: number) {
  pageSize.value = size
  page.value = 1
  if (isFull.value) loadFullPage()
}

function retryFullPage() {
  loadFullPage()
}

watch(historyPeriod, () => {
  if (!isFull.value) return
  page.value = 1
})

watch(query, (value) => {
  page.value = 1
  if (isFull.value) {
    // Instant local filter while the cloud search catches up.
    store.filterHistoryLocally({
      page: 1,
      pageSize: pageSize.value,
      query: value,
    })
  }
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedQuery.value = value
    if (isFull.value) {
      loadFullPage()
    }
  }, 250)
})

watch(
  () => store.captures[0]?.id,
  (id, prev) => {
    if (!id || id === prev) return
    page.value = 1
    if (isFull.value) loadFullPage()
    else loadPreviewFeed()
  },
)

function findCaptureById(captureId: string): VoiceCapture | undefined {
  return (
    store.captures.find((item) => item.id === captureId) ||
    store.historyPage.items.find((item) => item.id === captureId)
  )
}

watch(
  () => (detailOpen.value && viewing.value ? findCaptureById(viewing.value.id) : undefined),
  (next) => {
    if (next) viewing.value = next
  },
)

async function tryFocusCapture(captureId: string | null | undefined) {
  if (!captureId || !isFull.value) return

  let capture = findCaptureById(captureId)
  if (!capture) {
    if (!store.historyPage.loaded) {
      await loadFullPage()
      capture = findCaptureById(captureId)
    }
  }
  if (!capture) return

  openDetail(capture)
  const route = router.currentRoute.value
  if (route.query[QUERY.capture]) {
    const query = { ...route.query }
    delete query[QUERY.capture]
    void router.replace({ path: route.path, query })
  }
}

watch(
  () => props.focusCaptureId,
  (captureId) => {
    void tryFocusCapture(captureId)
  },
  { immediate: true },
)

watch(previewTotal, () => {
  if (!isFull.value) clampPreviewPage()
})

onMounted(() => {
  if (isFull.value) {
    syncPaginationFromStore()
    loadFullPage()
  } else {
    firstLookTimer = setTimeout(() => {
      firstLookExpired.value = true
    }, PREVIEW_FIRST_LOOK_CEILING_MS)
    void loadPreviewFeed()
  }
})

onUnmounted(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
  if (debounceTimer) clearTimeout(debounceTimer)
  if (firstLookTimer) clearTimeout(firstLookTimer)
  stopPlayback()
})

useErrorToast(() => (isFull.value ? store.historyError : null), {
  title: 'Could not load history',
  actionLabel: 'Retry',
  onAction: () => void retryFullPage(),
})
</script>

<template>
  <div :class="['space-y-4', centersEmpty && 'flex flex-1 flex-col']">
    <div v-if="isFull" class="space-y-3">
      <SectionHeading class="mb-0">Capture history</SectionHeading>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <SearchField
          v-model="query"
          placeholder="Search captures"
          variant="row"
          class="w-full sm:max-w-xs"
          input-class="outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none"
        >
          <template #icon>
            <PhMagnifyingGlass class="h-4 w-4" />
          </template>
        </SearchField>
        <div class="w-full sm:w-32">
          <Select v-model="historyPeriod">
            <SelectTrigger aria-label="Filter captures by date range">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="option in HISTORY_PERIOD_OPTIONS"
                :key="option.id"
                :value="option.id"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>

    <VoiceCaptureFeedSkeleton v-if="showHistorySkeleton || showPreviewSkeleton" />

    <DictationEmptyState
      v-else-if="showDictationEmpty"
      :heading="emptyHeading"
      :class="
        centersEmpty &&
        'relative z-10 flex-1 justify-center -mt-[calc(var(--home-hero-height,300px)-2.25rem)]'
      "
    >
      <VeennaButton
        v-if="!isFull && !hasNoDictations"
        variant="muted"
        class="dark:bg-white/[0.14] dark:hover:bg-white/20"
        @click="router.push('/dictation')"
      >
        View history
      </VeennaButton>
    </DictationEmptyState>

    <EmptyState v-else-if="showEmpty" class="py-10">
      <p>No captures match your search.</p>
    </EmptyState>

    <div v-else :class="listShellClass">
      <section v-for="group in groups" :key="group.label" :class="groupSectionClass">
        <div :class="[groupHeaderClass(group.period), 'flex items-center justify-between gap-3']">
          <span>{{ group.label }}</span>
          <button
            v-if="!isFull && group.period === 'today'"
            type="button"
            :class="veennaUi.btnNavAction"
            @click="router.push('/dictation')"
          >
            View all
          </button>
        </div>
        <ul class="space-y-2">
          <li v-for="item in group.items" :key="item.id" :class="itemClass">
            <div
              role="button"
              tabindex="0"
              class="flex w-full cursor-pointer flex-col text-left transition-colors"
              @click="openDetail(item)"
              @keydown.enter.prevent="openDetail(item)"
              @keydown.space.prevent="openDetail(item)"
            >
              <div class="flex items-center justify-between gap-3 p-2">
                <div class="flex min-w-0 flex-wrap items-baseline gap-2">
                  <time
                    class="text-caption leading-none tabular-nums text-veenna-muted"
                    :datetime="item.createdAt"
                  >
                    {{ timeLabel(item.createdAt) }}
                  </time>
                  <span
                    v-if="item.durationMs != null && item.durationMs > 0"
                    class="text-caption leading-none tabular-nums text-veenna-muted"
                  >
                    {{ formatDuration(item.durationMs) }}
                  </span>
                </div>
                <!--
                  One split button per row: Copy is the action people reach for,
                  everything else (playback included) lives behind the caret.
                -->
                <div class="flex shrink-0 items-stretch" @click.stop @keydown.stop>
                  <!-- Only while this capture plays; goes away on stop or when it ends. -->
                  <Button
                    v-if="playingId === item.id"
                    size="sm"
                    variant="flatMuted"
                    class="mr-px h-7 gap-1 rounded-r-none bg-destructive px-2.5 text-white hover:bg-destructive/90 hover:text-white"
                    title="Stop playback"
                    aria-label="Stop playback"
                    @click="stopPlayback"
                  >
                    <PhStop class="size-3.5" weight="fill" />
                    Stop
                  </Button>
                    <Button
                      size="sm"
                      variant="flatMuted"
                      :class="[
                        'h-7 gap-1 rounded-r-none bg-muted px-2.5',
                        playingId === item.id && 'rounded-l-none',
                      ]"
                      :disabled="isRowBusy(item)"
                      :title="copiedId === item.id ? 'Copied' : 'Copy capture'"
                      :aria-label="copiedId === item.id ? 'Copied' : 'Copy capture'"
                      @click="copyCapture(item)"
                    >
                      <PhCheck
                        v-if="copiedId === item.id"
                        class="size-3.5 text-veenna-accent"
                        weight="bold"
                      />
                      <PhCopy v-else class="size-3.5" weight="fill" />
                      {{ copiedId === item.id ? 'Copied' : 'Copy' }}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <Button
                          size="sm"
                          variant="flatMuted"
                          class="ml-px h-7 rounded-l-none bg-muted px-1.5"
                          aria-label="More actions"
                          title="More actions"
                          :disabled="isRowBusy(item)"
                        >
                          <PhSpinner
                            v-if="isRowBusy(item) || store.isAudioSaving(item.id)"
                            :class="veennaUi.spinnerIconSm"
                          />
                          <PhCaretDown v-else class="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" :side-offset="6">
                        <DropdownMenuItem
                          v-if="captureHasPlayableAudio(item)"
                          :disabled="
                            isRowBusy(item) ||
                            store.isAudioSaving(item.id) ||
                            playLoadingId === item.id
                          "
                          @select="togglePlayback(item)"
                        >
                          <PhSpinner
                            v-if="playLoadingId === item.id"
                            :class="veennaUi.spinnerIconSm"
                          />
                          {{ playingId === item.id ? 'Pause capture' : 'Play capture' }}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator
                          class="my-0.5"
                          v-if="captureHasPlayableAudio(item)"
                        />
                        <DropdownMenuItem
                          :disabled="
                            !captureHasPlayableAudio(item) ||
                            store.isAudioSaving(item.id) ||
                            isRowBusy(item)
                          "
                          @select="retryTranscript(item)"
                        >
                          Retry transcript
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          destructive
                          :disabled="isRowBusy(item)"
                          @select="confirmDeleteCapture(item)"
                        >
                          Delete transcript
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                </div>
              </div>
              <div class="h-px bg-veenna-divider" aria-hidden="true" />
              <div class="min-w-0 space-y-1 p-2">
                <p class="text-body leading-relaxed text-veenna-fg line-clamp-4">
                  {{ item.text.trim() }}
                </p>
              </div>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <DictationDetailModal
      :open="detailOpen"
      :capture="viewing"
      :title="detailTitle"
      :copied="detailCopyFeedback"
      :busy="viewing ? isRowBusy(viewing) || deletingId === viewing.id : false"
      :actions="detailActions"
      @close="closeDetail"
      @copy="copyFromDetail"
      @play="viewing && togglePlayback(viewing)"
      @retry-transcript="viewing && retryTranscript(viewing)"
      @delete="viewing && confirmDeleteCapture(viewing)"
    />

    <div v-if="showPagination" class="space-y-2 pt-2">
      <Pagination
        :current-page="page"
        :total-items="total"
        :items-per-page="pageSize"
        :loading="loading"
        :page-size-options="isFull ? undefined : PREVIEW_PAGE_SIZE_OPTIONS"
        @update:page="onPageChange"
        @update:items-per-page="onPageSizeChange"
      />
      <p
        v-if="showHistoryRefreshing"
        :class="[veennaUi.spinnerRow, 'text-caption text-veenna-muted']"
        aria-live="polite"
      >
        <PhSpinner :class="veennaUi.spinnerIconSm" />
        Updating
      </p>
    </div>

  </div>
</template>
