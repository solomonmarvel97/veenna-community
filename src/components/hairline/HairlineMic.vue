<template>
  <div ref="root" />
</template>

<script setup lang="ts">
import type { HairlineTheme } from './core'
import { mic } from './mic'
import { useHairline } from './useHairline'

const props = defineProps<{
  intensity?: number
  theme?: HairlineTheme
  label?: string
  onRead?: (text: string) => void
  play?: boolean
}>()

const root = useHairline(mic, props)
</script>
