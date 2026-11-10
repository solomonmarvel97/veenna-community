<script setup lang="ts">
import { computed } from 'vue'
import { HairlineMic } from '@/components/hairline'
import { VeennaButton } from '@/components/veenna'
import { useDictation } from '@/composables/useDictation'
import { useDictationStore } from '@/stores/dictation'

withDefaults(defineProps<{ heading?: string }>(), { heading: 'No dictations yet' })

const dictation = useDictation()
const dictationStore = useDictationStore()

const busy = computed(() => dictationStore.isRecording || dictationStore.mode === 'processing')

function startDictating() {
  if (busy.value) return
  void dictation.startRecording('continuous')
}
</script>

<template>
  <div class="flex flex-col items-center gap-4 py-6 text-center [--hairline-plate:var(--veenna-bg)]">
    <!-- The figure's viewBox ends well below the drawing, so the heading rises into that margin. -->
    <div class="flex flex-col items-center">
      <HairlineMic class="-mb-4 w-[200px]" play />
      <h2 class="text-title-sm font-medium text-veenna-fg">{{ heading }}</h2>
    </div>
    <div class="flex items-center justify-center gap-2">
      <VeennaButton variant="primary" :disabled="busy" @click="startDictating">
        Start dictating
      </VeennaButton>
      <slot />
    </div>
  </div>
</template>
