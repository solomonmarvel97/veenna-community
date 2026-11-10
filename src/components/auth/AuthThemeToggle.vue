<script setup lang="ts">
import { computed } from 'vue'
import { PhMonitor, PhMoon, PhSun } from '@phosphor-icons/vue'
import { useThemeStore, type ThemeMode } from '@/stores/theme'

const props = withDefaults(
  defineProps<{
    compact?: boolean
    roundedFull?: boolean
  }>(),
  { compact: true, roundedFull: true },
)

const theme = useThemeStore()

const currentTheme = computed(() => theme.mode)

const currentIcon = computed(() => {
  switch (currentTheme.value) {
    case 'light':
      return PhSun
    case 'dark':
      return PhMoon
    default:
      return PhMonitor
  }
})

const nextTheme = computed(() => {
  const order: ThemeMode[] = ['system', 'light', 'dark']
  const idx = order.indexOf(theme.mode)
  return order[(idx + 1) % order.length]
})
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center justify-center text-foreground transition-all duration-200 hover:bg-accent active:scale-95 focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--veenna-focus-subtle)]"
    :class="[
      props.compact ? 'h-7 w-7' : 'h-7 w-7',
      props.roundedFull ? 'rounded-full' : 'rounded-md',
    ]"
    :aria-label="`Switch to ${nextTheme} mode`"
    :title="`Theme: ${currentTheme}. Click to cycle.`"
    @click="theme.cycleMode()"
  >
    <component :is="currentIcon" :class="props.compact ? 'h-3.5 w-3.5' : 'h-5 w-5'" />
  </button>
</template>
