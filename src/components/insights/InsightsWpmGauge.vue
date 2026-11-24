<script setup lang="ts">
import { computed } from 'vue'
import ScoreArcGauge from '@/components/shared/ScoreArcGauge.vue'
import { veennaUi } from '@/lib/veennaUi'

const props = withDefaults(
  defineProps<{
    wpm: number
    rankLabel: string
  }>(),
  {},
)

/** Map speaking pace to 0-100 for the segmented arc (200 WPM = full arc). */
const wpmScore = computed(() => Math.min(100, Math.max(0, (props.wpm / 200) * 100)))

const wpmDisplay = computed(() => (props.wpm > 0 ? String(props.wpm) : '-'))
</script>

<template>
  <div :class="[veennaUi.settingsCard, 'flex h-full flex-col']">
    <div :class="veennaUi.settingsGroupHeader">
      <h3 :class="veennaUi.settingsGroupLabel">Speaking pace</h3>
      <span class="text-caption tabular-nums text-veenna-muted">Words per minute</span>
    </div>

    <div class="flex flex-1 flex-col items-center justify-center px-4 py-3">
      <ScoreArcGauge :score="wpmScore" size="md" suffix="" inactive-variant="solid" class="w-full">
        <template #score>
          <div class="flex flex-col items-center justify-center gap-1 pb-1 pt-10 sm:pt-11">
            <span
              class="font-mono text-stat font-normal leading-none tabular-nums text-veenna-fg sm:text-stat"
            >
              {{ wpmDisplay }}
            </span>
          </div>
        </template>
      </ScoreArcGauge>
    </div>

    <p class="truncate border-t border-veenna-divider px-4 py-2.5 text-caption text-veenna-muted">
      {{ rankLabel }}
    </p>
  </div>
</template>
