<script setup lang="ts">
import { computed } from 'vue'
import { PhChartLineUp } from '@phosphor-icons/vue'

defineOptions({ name: 'ChartLineUpIcon' })

/**
 * The chart icon (Performance, insights, the trend toggle) is never filled.
 * Its filled weight reads as a solid picture frame, so `fill` and `duotone`
 * fall back to the outline wherever a caller - or a tab row that fills every
 * icon - asks for them. Import this, never PhChartLineUp; a guard test enforces it.
 */
const props = defineProps<{ weight?: string }>()

const outlineWeight = computed(() =>
  props.weight === 'fill' || props.weight === 'duotone' || !props.weight ? 'regular' : props.weight,
)
</script>

<template>
  <PhChartLineUp :weight="outlineWeight as 'regular'" />
</template>
