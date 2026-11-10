<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import { cn } from '@/lib/utils'
import { veennaUi } from '@/lib/veennaUi'
import CountBadge from '@/components/ui/CountBadge.vue'

export type SegmentOption = {
  id: string
  label: string
  icon?: Component
  iconWeight?: 'regular' | 'fill' | 'bold' | 'duotone'
  disabled?: boolean
  title?: string
  /** Optional count / status chip rendered after the label. */
  badge?: string | number | null
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: SegmentOption[]
    class?: string
    variant?: 'underline' | 'pill' | 'hud'
    ariaLabel?: string
    /** Stretch the track and tabs to the full parent width. */
    fill?: boolean
  }>(),
  {
    variant: 'underline',
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const isCapsule = computed(() => props.variant === 'pill' || props.variant === 'hud')

function trackClass() {
  if (props.variant === 'hud') {
    return cn(veennaUi.segmentHudTrack, veennaUi.tabScrollTrack, props.fill && 'flex w-full')
  }
  if (props.variant === 'pill') {
    return cn(veennaUi.segmentPillTrack, veennaUi.tabScrollTrack, props.fill && 'flex w-full')
  }
  return cn(veennaUi.tabScrollTrack, props.fill && 'flex w-full')
}

function tabClass(selected: boolean) {
  if (props.variant === 'hud') {
    return cn(
      veennaUi.segmentHudTab,
      selected ? veennaUi.segmentHudTabActive : veennaUi.segmentHudTabInactive,
    )
  }
  if (props.variant === 'pill') {
    return cn(
      veennaUi.segmentPillTab,
      selected ? veennaUi.segmentPillTabActive : veennaUi.segmentPillTabInactive,
      props.fill && 'flex flex-1 justify-center',
    )
  }
  return cn(
    'inline-flex h-7 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border-b-2 px-2.5 py-0 text-caption transition-colors focus-visible:shadow-[0_0_0_1px_var(--veenna-focus-subtle)]',
    selected
      ? 'border-transparent bg-[var(--veenna-tab-active-bg)] font-medium text-[var(--veenna-tab-active-fg)] shadow-sm'
      : 'border-transparent text-veenna-muted hover:text-veenna-fg',
  )
}
</script>

<template>
  <div :class="cn('min-w-0', props.class)">
    <div :class="trackClass()" role="tablist" :aria-label="ariaLabel">
      <div
        :class="
          cn(
            'flex',
            isCapsule ? 'gap-0.5' : 'gap-4',
            variant === 'pill' && 'h-full',
            props.fill ? 'w-full' : 'w-max min-w-full',
          )
        "
      >
        <button
          v-for="option in options"
          :key="option.id"
          type="button"
          role="tab"
          :aria-selected="modelValue === option.id"
          :disabled="option.disabled"
          :title="option.title"
          class="outline-none disabled:cursor-not-allowed disabled:opacity-40"
          :class="tabClass(modelValue === option.id)"
          @click="!option.disabled && emit('update:modelValue', option.id)"
        >
          <component
            :is="option.icon"
            v-if="option.icon"
            class="h-3.5 w-3.5 shrink-0"
            :weight="option.iconWeight ?? (modelValue === option.id ? 'fill' : 'regular')"
            aria-hidden="true"
          />
          {{ option.label }}
          <CountBadge
            v-if="option.badge != null && option.badge !== '' && Number(option.badge) > 0"
            :count="Number(option.badge)"
            :size="16"
            class="ml-1"
          />
        </button>
      </div>
    </div>
  </div>
</template>
