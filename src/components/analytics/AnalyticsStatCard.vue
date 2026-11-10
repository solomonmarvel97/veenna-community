<script setup lang="ts">
import { veennaUi } from '@/lib/veennaUi'

/**
 * One Insights figure in the standard card: the title in a bordered header, the
 * amount in the body, and the supporting line in a divided footer. No padding on
 * the card so both dividers run edge to edge.
 */
defineProps<{
  label: string
  value: string
  note?: string
  /** Accent the footer line (e.g. a growth badge). */
  noteAccent?: boolean
}>()
</script>

<template>
  <div :class="[veennaUi.settingsCard, 'flex flex-col']">
    <div :class="veennaUi.settingsGroupHeader">
      <span :class="veennaUi.settingsGroupLabel">{{ label }}</span>
    </div>
    <div class="flex-1 px-4 py-4">
      <p class="text-stat font-semibold tabular-nums leading-none text-veenna-fg">{{ value }}</p>
    </div>
    <p
      class="truncate border-t border-veenna-divider px-4 py-2.5 text-caption"
      :class="noteAccent ? 'text-veenna-accent' : 'text-veenna-muted'"
    >
      {{ note || ' ' }}
    </p>
  </div>
</template>
