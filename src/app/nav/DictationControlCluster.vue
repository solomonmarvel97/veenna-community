<script setup lang="ts">
import { computed, ref } from 'vue'
import { PhCaretDown, PhMicrophone, PhRecord } from '@phosphor-icons/vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useDictation } from '@/composables/useDictation'
import { useDictationStore } from '@/stores/dictation'
import AnimatedDots from '@/components/ui/AnimatedDots.vue'
import { useNavSidebarChrome } from '@/composables/useNavSidebarChrome'

/** The sidebar mic: start or stop a dictation, with a small menu beside it. */
const { iconRail: navCollapsed } = useNavSidebarChrome()
const dictation = useDictation()
const dictationStore = useDictationStore()

const props = withDefaults(
  defineProps<{
    layout?: 'sidebar' | 'bar'
  }>(),
  {
    layout: 'bar',
  },
)

const clusterClass = computed(() =>
  props.layout === 'sidebar'
    ? 'flex w-full min-w-0 flex-nowrap items-center justify-center gap-2.5'
    : 'flex flex-nowrap items-center justify-center gap-2.5',
)
const menuOpen = ref(false)

const isRecording = computed(() => dictationStore.isRecording)
const isProcessing = computed(() => dictationStore.mode === 'processing')
const disabled = computed(() => isProcessing.value)

const recordingMenuLabel = computed(() => (isRecording.value ? 'Stop & process' : 'Start recording'))
const ariaLabel = computed(() => {
  if (isProcessing.value) return 'Processing dictation'
  if (isRecording.value) return 'Stop dictation'
  return 'Start dictation'
})

function onMicClick() {
  if (disabled.value) return
  if (dictationStore.isRecording) {
    void dictation.finalizeRecording()
    return
  }
  void dictation.startRecording('continuous')
}

function onRecordingMenuSelect() {
  menuOpen.value = false
  if (disabled.value) return
  if (isRecording.value) void dictation.finalizeRecording()
  else void dictation.startRecording('continuous')
}
</script>

<template>
  <div :class="clusterClass">
    <div
      class="nav-dictation-mic-group shrink-0"
      data-veenna-dictation-ui
      :class="{ 'format-toggle-group-on': isRecording || isProcessing }"
    >
      <button
        type="button"
        class="nav-dictation-mic-main disabled:cursor-not-allowed disabled:opacity-45"
        :disabled="disabled"
        :aria-label="ariaLabel"
        :title="ariaLabel"
        @click="onMicClick"
      >
        <PhRecord
          v-if="isRecording"
          class="shrink-0 text-red-500"
          weight="fill"
          aria-hidden="true"
        />
        <PhMicrophone v-else class="shrink-0" weight="fill" aria-hidden="true" />
      </button>

      <DropdownMenu v-if="!navCollapsed" v-model:open="menuOpen">
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="nav-dictation-mic-mode"
            title="Dictation menu"
            aria-label="Dictation menu"
            :aria-expanded="menuOpen"
            aria-haspopup="menu"
            :disabled="isProcessing"
          >
            <PhCaretDown class="shrink-0" weight="bold" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" :side-offset="8">
          <DropdownMenuLabel class="text-veenna-muted">Capture</DropdownMenuLabel>
          <DropdownMenuItem :disabled="disabled" @select="onRecordingMenuSelect">
            <span class="truncate font-medium">
              <AnimatedDots v-if="isProcessing" label="Processing" size="sm" class="font-medium" />
              <template v-else>{{ recordingMenuLabel }}</template>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</template>
