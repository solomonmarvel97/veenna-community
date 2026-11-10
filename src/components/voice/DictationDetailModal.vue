<script setup lang="ts">
/**
 * One dictation, opened: the text is the page, the facts sit under it in one quiet line, and the
 * actions the row menu holds sit in the header. The feed owns what each action does; this only
 * shows what applies and says which one was asked for.
 */
import { computed } from 'vue'
import { format, parseISO } from 'date-fns'
import { PhCaretDown, PhCheck, PhCopy, PhSpinner } from '@phosphor-icons/vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ModalBody, ModalHeader, VeennaModal } from '@/components/veenna'
import { captureChannelLabel } from '@/lib/sync/captureChannel'
import type { VoiceCapture } from '@/stores/voiceCaptures'

defineOptions({ name: 'DictationDetailModal' })

/** What the feed says can be done with this capture right now; each flag is the row menu's own rule. */
export type DictationDetailActions = {
  canPlay: boolean
  playing: boolean
  playLoading: boolean
  /** Audio is on another device and has not reached this one; the text says where. */
  audioPendingLabel: string | null
  canRetry: boolean
}

const props = defineProps<{
  open: boolean
  capture: VoiceCapture | null
  title: string
  copied: boolean
  busy: boolean
  actions: DictationDetailActions
}>()

const emit = defineEmits<{
  close: []
  /** The text on show, so a copy is what the owner is reading. */
  copy: [text: string]
  play: []
  'retry-transcript': []
  delete: []
}>()

const shownText = computed(() => String(props.capture?.text || '').trim())

const facts = computed(() => {
  const item = props.capture
  if (!item) return []
  const rows: { label: string; value: string }[] = [
    { label: 'Captured', value: format(parseISO(item.createdAt), "MMM d, yyyy 'at' h:mm a") },
  ]
  if (item.durationMs != null && item.durationMs > 0) {
    rows.push({ label: 'Duration', value: formatDuration(item.durationMs) })
  }
  const words = item.wordCount || shownText.value.split(/\s+/).filter(Boolean).length
  rows.push({ label: 'Words', value: String(words) })
  if (item.originChannel) {
    rows.push({ label: 'Recorded on', value: captureChannelLabel(item.originChannel) })
  }
  return rows
})

function formatDuration(ms: number) {
  const totalSec = Math.round(ms / 1000)
  if (totalSec < 60) return `${totalSec}s`
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  return secs ? `${mins}m ${secs}s` : `${mins}m`
}

const hasAudioItem = computed(
  () => props.actions.canPlay || Boolean(props.actions.audioPendingLabel),
)
const hasMore = computed(() => props.actions.canRetry)
</script>

<template>
  <VeennaModal
    :open="open"
    size="lg"
    title-id="capture-detail-title"
    panel-class="flex h-[min(calc(100dvh-1rem),34rem)] w-full flex-col overflow-hidden"
    @close="emit('close')"
  >
    <template v-if="capture">
      <ModalHeader :title="title" title-id="capture-detail-title" @close="emit('close')">
        <template #actions>
          <!-- One split button, as on the feed rows: Copy up front, everything else behind the caret. -->
          <div class="flex shrink-0 items-stretch">
            <Button
              size="sm"
              variant="flatMuted"
              class="h-7 gap-1 rounded-r-none bg-muted px-2.5"
              :title="copied ? 'Copied' : 'Copy'"
              :aria-label="copied ? 'Copied' : 'Copy'"
              :disabled="!shownText"
              @click="emit('copy', shownText)"
            >
              <PhCheck v-if="copied" class="size-3.5 text-veenna-accent" weight="bold" />
              <PhCopy v-else class="size-3.5" weight="fill" />
              {{ copied ? 'Copied' : 'Copy' }}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button
                  size="sm"
                  variant="flatMuted"
                  class="ml-px h-7 rounded-l-none bg-muted px-1.5"
                  aria-label="More actions"
                  title="More actions"
                >
                  <PhSpinner v-if="actions.playLoading" class="size-3.5 animate-spin" />
                  <PhCaretDown v-else class="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" :side-offset="6">
                <DropdownMenuItem
                  v-if="actions.canPlay"
                  :disabled="busy || actions.playLoading"
                  @select="emit('play')"
                >
                  <PhSpinner v-if="actions.playLoading" class="size-3.5 animate-spin" />
                  {{ actions.playing ? 'Pause' : 'Play' }}
                </DropdownMenuItem>
                <DropdownMenuItem v-else-if="actions.audioPendingLabel" disabled>
                  <PhSpinner class="size-3.5 animate-spin" />
                  {{ actions.audioPendingLabel }}
                </DropdownMenuItem>
                <DropdownMenuSeparator
                  v-if="hasAudioItem && hasMore"
                />
                <DropdownMenuItem
                  v-if="actions.canRetry"
                  :disabled="busy"
                  @select="emit('retry-transcript')"
                >
                  Retry transcript
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive :disabled="busy" @select="emit('delete')">
                  Delete transcript
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </template>
      </ModalHeader>

      <ModalBody>
        <p class="select-text whitespace-pre-wrap break-words text-body leading-relaxed text-veenna-fg">
          {{ shownText }}
        </p>
      </ModalBody>

      <!-- Outside the scrolling body: it sits at the bottom, and its line runs edge to edge. -->
      <dl
        class="flex shrink-0 flex-wrap gap-x-5 gap-y-1.5 border-t border-veenna-divider px-4 py-3 text-caption text-veenna-muted"
      >
        <div v-for="fact in facts" :key="fact.label" class="flex items-baseline gap-1.5">
          <dt>{{ fact.label }}</dt>
          <dd class="text-veenna-fg">{{ fact.value }}</dd>
        </div>
      </dl>
    </template>
  </VeennaModal>
</template>
