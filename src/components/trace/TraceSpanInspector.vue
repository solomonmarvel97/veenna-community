<script setup lang="ts">
/**
 * The selected span, in full: what it was, how long it took, what it carried,
 * and - at verbose - the redacted payload.
 */
import { computed } from 'vue'
import { PhWarningCircle } from '@phosphor-icons/vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import type { TraceSpan } from '@/lib/trace/types'
import { displayAttrs, formatClock, formatMs, kindColor, spanMarks, TIER_LABELS } from './traceUi'

const props = withDefaults(
  defineProps<{
    span: TraceSpan | null
    loading?: boolean
    /** Full-bleed blocks split by edge-to-edge lines; the host supplies no padding. */
    separated?: boolean
  }>(),
  { loading: false, separated: false },
)

const block = computed(() => (props.separated ? 'border-t border-veenna-divider px-5 py-3' : ''))

const attrs = computed(() => (props.span ? displayAttrs(props.span) : []))
const marks = computed(() => (props.span ? spanMarks(props.span) : []))

const payloadText = computed(() => {
  if (!props.span || props.span.payload === undefined || props.span.payload === null) return null
  try {
    return JSON.stringify(props.span.payload, null, 2)
  } catch {
    return String(props.span.payload)
  }
})
</script>

<template>
  <div
    v-if="loading"
    :class="['flex flex-col gap-4 text-caption', separated ? 'px-5 py-3' : '']"
    aria-busy="true"
    aria-label="Loading span details"
  >
    <header class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <Skeleton class="h-2.5 w-2.5 shrink-0" rounded="sm" />
        <Skeleton class="h-4 w-36" />
      </div>
      <div class="flex items-center gap-1.5">
        <Skeleton class="h-5 w-14 rounded-sm" />
        <Skeleton class="h-5 w-12 rounded-sm" />
      </div>
    </header>

    <dl class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.5">
      <dt class="text-veenna-muted">Duration</dt>
      <dd><Skeleton class="h-3.5 w-14" /></dd>
      <dt class="text-veenna-muted">Started</dt>
      <dd><Skeleton class="h-3.5 w-20" /></dd>
      <dt class="text-veenna-muted">Span</dt>
      <dd><Skeleton class="h-3.5 w-28" /></dd>
      <dt class="text-veenna-muted">Parent</dt>
      <dd><Skeleton class="h-3.5 w-28" /></dd>
    </dl>

    <div class="flex flex-col gap-2 pt-1">
      <Skeleton class="h-3 w-16" />
      <Skeleton class="h-24 w-full rounded-sm" />
    </div>
  </div>

  <div
    v-else-if="!span"
    :class="[
      'flex h-full items-center justify-center text-center',
      separated ? 'px-5 py-4' : 'px-4',
    ]"
  >
    <p class="text-caption text-veenna-muted">Select a span to inspect it.</p>
  </div>

  <div v-else :class="['flex flex-col text-caption', separated ? '' : 'gap-4']">
    <header :class="['flex flex-col gap-1.5', separated ? 'px-5 py-3' : '']">
      <div class="flex items-center gap-2">
        <span
          class="h-2.5 w-2.5 shrink-0 rounded-sm"
          :style="{ backgroundColor: kindColor(span.kind) }"
        />
        <h4 class="min-w-0 break-all font-semibold text-veenna-fg">{{ span.name }}</h4>
      </div>
      <div class="flex flex-wrap items-center gap-1.5 text-veenna-muted">
        <span class="rounded-sm bg-veenna-row px-1.5 py-0.5">{{ TIER_LABELS[span.tier] }}</span>
        <span class="rounded-sm bg-veenna-row px-1.5 py-0.5">{{ span.kind }}</span>
        <span
          v-if="span.ok === false"
          class="rounded-sm bg-red-500/15 px-1.5 py-0.5 font-medium text-red-500"
        >
          failed
        </span>
        <span v-else-if="span.ms === null" class="rounded-sm bg-veenna-row px-1.5 py-0.5"
          >running</span
        >
      </div>
    </header>

    <dl :class="['grid grid-cols-[auto_1fr] gap-x-3 gap-y-1', block]">
      <dt class="text-veenna-muted">Duration</dt>
      <dd class="tabular-nums text-veenna-fg">{{ formatMs(span.ms) }}</dd>
      <dt class="text-veenna-muted">Started</dt>
      <dd class="tabular-nums text-veenna-fg">{{ formatClock(span.started_at) }}</dd>
      <dt class="text-veenna-muted">Span</dt>
      <dd class="break-all font-mono text-label text-veenna-secondary">{{ span.span_id }}</dd>
      <dt v-if="span.parent_id" class="text-veenna-muted">Parent</dt>
      <dd v-if="span.parent_id" class="break-all font-mono text-label text-veenna-secondary">
        {{ span.parent_id }}
      </dd>
    </dl>

    <section
      v-if="span.error"
      :class="separated ? [block, 'bg-red-500/10'] : 'rounded-sm bg-red-500/10 p-2.5'"
    >
      <div class="mb-1 flex items-center gap-1.5 font-medium text-red-500">
        <PhWarningCircle class="h-3.5 w-3.5" weight="light" />
        <span>{{ span.error.code || 'Error' }}</span>
      </div>
      <p class="break-words text-veenna-fg">{{ span.error.message }}</p>
      <pre
        v-if="span.error.stack"
        class="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-micro text-veenna-secondary"
        >{{ span.error.stack }}</pre>
    </section>

    <section v-if="marks.length" :class="block">
      <h5 class="mb-1 text-label font-medium uppercase tracking-overline text-veenna-muted">
        Marks
      </h5>
      <ul class="flex flex-col gap-0.5">
        <li v-for="mark in marks" :key="mark.name" class="flex justify-between gap-3">
          <span class="text-veenna-secondary">{{ mark.name }}</span>
          <span class="tabular-nums text-veenna-fg">{{ formatMs(mark.ms) }}</span>
        </li>
      </ul>
    </section>

    <section v-if="attrs.length" :class="block">
      <h5 class="mb-1 text-label font-medium uppercase tracking-overline text-veenna-muted">
        Attributes
      </h5>
      <ul class="flex flex-col gap-0.5">
        <li v-for="[key, value] in attrs" :key="key" class="flex justify-between gap-3">
          <span class="shrink-0 text-veenna-secondary">{{ key }}</span>
          <span class="min-w-0 break-all text-right text-veenna-fg">{{ value }}</span>
        </li>
      </ul>
    </section>

    <section v-if="payloadText" :class="block">
      <h5 class="mb-1 text-label font-medium uppercase tracking-overline text-veenna-muted">
        Payload
        <span class="ml-1 font-normal normal-case tracking-normal">(verbose, redacted)</span>
      </h5>
      <pre
        class="max-h-64 overflow-auto rounded-sm bg-veenna-row p-2 font-mono text-micro leading-relaxed text-veenna-fg"
        >{{ payloadText }}</pre>
    </section>

    <section v-if="span.links?.length" :class="block">
      <h5 class="mb-1 text-label font-medium uppercase tracking-overline text-veenna-muted">
        Caused
      </h5>
      <ul class="flex flex-col gap-0.5">
        <li
          v-for="link in span.links"
          :key="link"
          class="break-all font-mono text-micro text-veenna-secondary"
        >
          {{ link }}
        </li>
      </ul>
    </section>
  </div>
</template>
