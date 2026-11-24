<script setup lang="ts">
/**
 * The waterfall: one row per span, indented by depth, bar positioned by offset
 * and scaled by duration.
 *
 * Subtrees collapse because a `spawn_agents` fan-out is 200 rows and nobody
 * wants to scroll past it to reach the persist step.
 */
import { computed, ref } from 'vue'
import { PhCaretDown, PhCaretRight, PhWarningCircle } from '@phosphor-icons/vue'
import { buildTree, flattenTree } from '@/lib/trace'
import type { TraceNode, TraceSpan } from '@/lib/trace/types'
import { formatMs, isRunning, kindColor, spanMarks } from './traceUi'
import { cn } from '@/lib/utils'

const props = defineProps<{
  spans: TraceSpan[]
  selectedId?: string | null
}>()

const emit = defineEmits<{ select: [span: TraceSpan] }>()

const collapsed = ref(new Set<string>())

const tree = computed(() => buildTree(props.spans))

/** Total width the bars are scaled against. Never zero - a 0ms trace still draws. */
const totalMs = computed(() => Math.max(1, tree.value.traceEnd - tree.value.traceStart))

const rows = computed(() => {
  const all = flattenTree(tree.value.roots)
  const hidden = new Set<string>()
  const out: TraceNode[] = []

  for (const node of all) {
    const parentId = node.span.parent_id
    if (parentId && hidden.has(parentId)) {
      hidden.add(node.span.span_id)
      continue
    }
    out.push(node)
    if (collapsed.value.has(node.span.span_id)) hidden.add(node.span.span_id)
  }
  return out
})

function hasChildren(node: TraceNode): boolean {
  return node.children.length > 0
}

function toggle(node: TraceNode) {
  const next = new Set(collapsed.value)
  if (next.has(node.span.span_id)) next.delete(node.span.span_id)
  else next.add(node.span.span_id)
  collapsed.value = next
}

function barLeft(node: TraceNode): string {
  return `${(node.offsetMs / totalMs.value) * 100}%`
}

function barWidth(node: TraceNode): string {
  const ms = node.span.ms ?? 0
  // A sub-pixel bar is invisible; give every span a floor so it can be clicked.
  const pct = (ms / totalMs.value) * 100
  return `${Math.max(pct, 0.6)}%`
}

/** A mark's position on the whole track, not on its own bar. */
function markLeft(node: TraceNode, markMs: number): string {
  const pct = ((node.offsetMs + markMs) / totalMs.value) * 100
  return `${Math.min(100, Math.max(0, pct))}%`
}
</script>

<template>
  <div
    class="flex flex-col divide-y divide-veenna-divider overflow-hidden rounded-sm border border-veenna-divider text-caption"
  >
    <div
      v-for="node in rows"
      :key="node.span.span_id"
      :class="
        cn(
          'group flex cursor-pointer items-center gap-2 px-2.5 py-1.5 transition-colors',
          props.selectedId === node.span.span_id ? 'bg-veenna-row-hover' : 'hover:bg-veenna-row/70',
        )
      "
      role="button"
      tabindex="0"
      @click="emit('select', node.span)"
      @keydown.enter="emit('select', node.span)"
      @keydown.space.prevent="emit('select', node.span)"
    >
      <!-- Name column -->
      <div
        class="flex min-w-0 shrink-0 items-center gap-1"
        :style="{ width: '17rem', paddingLeft: `${node.depth * 0.75}rem` }"
      >
        <button
          v-if="hasChildren(node)"
          type="button"
          class="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-veenna-icon-muted hover:text-veenna-fg"
          :aria-label="collapsed.has(node.span.span_id) ? 'Expand' : 'Collapse'"
          @click.stop="toggle(node)"
        >
          <PhCaretRight v-if="collapsed.has(node.span.span_id)" class="h-3 w-3" weight="light" />
          <PhCaretDown v-else class="h-3 w-3" weight="light" />
        </button>
        <span v-else class="h-4 w-4 shrink-0" />

        <span
          class="h-2 w-2 shrink-0 rounded-sm"
          :style="{ backgroundColor: kindColor(node.span.kind) }"
          :title="node.span.kind"
        />
        <span
          class="truncate font-medium"
          :class="node.span.ok === false ? 'text-red-500' : 'text-veenna-fg'"
          :title="node.span.name"
        >
          {{ node.span.name }}
        </span>
        <PhWarningCircle
          v-if="node.skewed"
          class="h-3 w-3 shrink-0 text-amber-500"
          title="This span reported a start time before its parent - clocks disagree across tiers."
        />
      </div>

      <!-- Bar track -->
      <div class="relative h-4 min-w-0 flex-1 overflow-hidden rounded-sm bg-veenna-row/50">
        <div
          class="absolute top-0 h-full rounded-sm"
          :class="isRunning(node.span) ? 'animate-pulse opacity-60' : ''"
          :style="{
            left: barLeft(node),
            width: barWidth(node),
            backgroundColor: node.span.ok === false ? '#ef4444' : kindColor(node.span.kind),
          }"
        />
        <span
          v-for="mark in spanMarks(node.span)"
          :key="mark.name"
          class="absolute top-0 h-full w-[2px] bg-white/80 mix-blend-difference"
          :style="{ left: markLeft(node, mark.ms) }"
          :title="`${mark.name} at ${mark.ms}ms`"
        />
      </div>

      <!-- Duration -->
      <span
        class="w-16 shrink-0 text-right tabular-nums"
        :class="node.span.ok === false ? 'text-red-500' : 'text-veenna-muted'"
      >
        {{ isRunning(node.span) ? '…' : formatMs(node.span.ms) }}
      </span>
    </div>

    <p v-if="rows.length === 0" class="px-2 py-6 text-center text-veenna-muted">
      No spans recorded for this trace.
    </p>
  </div>
</template>
