<script setup lang="ts">
/**
 * The trace viewer, opened from the developer icon on a chat message.
 *
 * Prefers the client's own collector - those spans include the browser work
 * that happened before the request, which the server never saw - and falls
 * back to fetching a stored trace when this window did not run the turn.
 */
import { computed, ref, watch } from 'vue'
import { PhCopy, PhWarningCircle, PhX } from '@phosphor-icons/vue'
import CopiedCheck from '@/components/ui/CopiedCheck.vue'
import { VeennaModal } from '@/components/veenna'
import { collector, copyTraceToClipboard } from '@/lib/trace'
import type { TraceRun, TraceSpan } from '@/lib/trace/types'
import { useToast } from '@/components/ui/toast/use-toast'
import { veennaUi } from '@/lib/veennaUi'
import TraceWaterfall from './TraceWaterfall.vue'
import TraceWaterfallSkeleton from './TraceWaterfallSkeleton.vue'
import TraceSpanInspector from './TraceSpanInspector.vue'
import { formatMs, TIER_LABELS } from './traceUi'
import Skeleton from '@/components/ui/Skeleton.vue'

const { toast } = useToast()

const props = defineProps<{
  open: boolean
  traceId: string | null
}>()

const emit = defineEmits<{ close: [] }>()

const titleId = 'trace-modal-title'

const selectedSpanId = ref<string | null>(null)
const remoteRun = ref<TraceRun | null>(null)
const remoteSpans = ref<TraceSpan[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)
const copied = ref(false)

/** The client-side trace, when this window is the one that ran the turn. */
const localTrace = computed(() => collector.get(props.traceId))

const run = computed<TraceRun | null>(() => {
  const local = localTrace.value
  if (local) {
    const { spans: _spans, index: _index, ...rest } = local
    return rest
  }
  return remoteRun.value
})

const spans = computed<TraceSpan[]>(() => localTrace.value?.spans ?? remoteSpans.value)

const selectedSpan = computed(
  () => spans.value.find((s) => s.span_id === selectedSpanId.value) ?? null,
)

/** Tiers that actually reported, so the header can say how far the trace reached. */

const tiers = computed(() => {
  const seen = new Set<string>()
  for (const span of spans.value) seen.add(span.tier)
  return [...seen]
})

watch(
  () => [props.open, props.traceId] as const,
  ([isOpen]) => {
    if (!isOpen) return
    selectedSpanId.value = null
    remoteRun.value = null
    remoteSpans.value = []
  },
  { immediate: true },
)

watch(
  () => spans.value,
  (newSpans) => {
    if (newSpans.length === 0) {
      selectedSpanId.value = null
      return
    }
    if (!selectedSpanId.value || !newSpans.some((s) => s.span_id === selectedSpanId.value)) {
      const firstSpan = newSpans.find((s) => !s.parent_id) || newSpans[0]
      selectedSpanId.value = firstSpan.span_id
    }
  },
  { immediate: true },
)

async function onCopy() {
  if (!run.value) return
  const ok = await copyTraceToClipboard(run.value, spans.value)
  if (!ok) {
    toast({ title: 'Could not copy', variant: 'destructive' })
    return
  }
  copied.value = true
  toast({ title: 'Trace copied' })
  setTimeout(() => {
    copied.value = false
  }, 1600)
}
</script>

<template>
  <VeennaModal
    :open="open"
    :title-id="titleId"
    size="lg"
    panel-class="h-[min(88vh,760px)] max-w-[min(96vw,64rem)] w-full overflow-hidden p-0"
    @close="emit('close')"
  >
    <div class="flex h-full min-h-0 w-full flex-col">
      <header
        class="flex shrink-0 items-center gap-3 border-b border-veenna-divider px-4 py-3 lg:px-5"
      >
        <div class="min-w-0 flex-1">
          <h2 :id="titleId" class="truncate text-body font-semibold text-veenna-fg">
            {{ run?.root_name || 'Trace' }}
          </h2>
        </div>

        <button
          type="button"
          :class="[veennaUi.btnSecondary, 'h-7 shrink-0 gap-1.5 px-2.5 text-caption']"
          title="Copy the whole trace to the clipboard"
          @click="onCopy"
        >
          <CopiedCheck v-if="copied" class="h-3.5 w-3.5" />
          <PhCopy v-else class="h-3.5 w-3.5" weight="light" />
          <span>{{ copied ? 'Copied' : 'Copy trace' }}</span>
        </button>

        <button
          type="button"
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-veenna-icon-muted transition-colors hover:text-veenna-icon"
          aria-label="Close trace"
          @click="emit('close')"
        >
          <PhX class="h-4 w-4" />
        </button>
      </header>

      <div
        v-if="run?.error_message"
        class="flex shrink-0 items-center gap-2 border-b border-red-500/25 bg-red-500/10 px-4 py-2 text-caption text-red-500 lg:px-5"
      >
        <PhWarningCircle class="h-4 w-4 shrink-0" weight="light" />
        <span class="min-w-0 break-words">{{ run.error_message }}</span>
      </div>

      <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div :class="[veennaUi.scrollHidden, 'min-h-0 flex-1 px-3 py-3 lg:px-4']">
          <p v-if="loadError" class="py-10 text-center text-caption text-veenna-muted">
            {{ loadError }}
          </p>
          <TraceWaterfallSkeleton v-else-if="loading" />
          <TraceWaterfall
            v-else
            :spans="spans"
            :selected-id="selectedSpanId"
            @select="selectedSpanId = $event.span_id"
          />
        </div>

        <aside
          :class="[
            veennaUi.scrollHidden,
            'min-h-0 shrink-0 border-t border-veenna-divider px-4 py-3 lg:w-80 lg:border-l lg:border-t-0',
          ]"
        >
          <TraceSpanInspector :span="selectedSpan" :loading="loading" />
        </aside>
      </div>

      <footer
        class="flex shrink-0 items-center gap-3 border-t border-veenna-divider px-4 py-2 lg:px-5"
      >
        <div
          class="flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-veenna-muted flex-1"
        >
          <span class="font-mono">{{ traceId?.slice(0, 16) }}…</span>
          <span v-if="run" class="tabular-nums">{{ formatMs(run.total_ms) }}</span>
          <Skeleton v-if="loading" class="h-2.5 w-14" />
          <span v-else>{{ spans.length }} spans</span>
          <span v-if="tiers.length" class="flex items-center gap-1">
            <span v-for="tier in tiers" :key="tier" class="rounded-sm bg-veenna-row px-1.5 py-0.5">
              {{ TIER_LABELS[tier as keyof typeof TIER_LABELS] || tier }}
            </span>
          </span>
          <span
            v-if="run?.level === 'verbose'"
            class="rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-amber-600"
          >
            verbose
          </span>
          <span v-if="run?.open" class="text-veenna-accent">running…</span>
        </div>
      </footer>
    </div>
  </VeennaModal>
</template>
