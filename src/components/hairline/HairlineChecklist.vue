<template>
  <div ref="root" />
</template>

<script setup lang="ts">
import { checklist } from './checklist'
import type { HairlineTheme } from './core'
import { useHairline } from './useHairline'

const props = defineProps<{
  intensity?: number
  theme?: HairlineTheme
  label?: string
  onRead?: (text: string) => void
  play?: boolean
}>()

const root = useHairline(checklist, props)
</script>
