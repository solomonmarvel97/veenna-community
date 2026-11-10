<script setup lang="ts">
import {
  PhEnvelopeSimple,
  PhFileText,
  PhInfinity,
  PhChatCircle,
  PhBriefcase,
} from '@phosphor-icons/vue'
import { computed, h, type Component } from 'vue'
import AppLogo from '@/components/app/AppLogo.vue'
import type { AggregatedUsageCategory } from '@/composables/useVoiceInsights'
import type { UsageCategoryId } from '@/lib/insightsCopy'
import { veennaUi } from '@/lib/veennaUi'

const props = defineProps<{
  categories: AggregatedUsageCategory[]
  totalApps: number
}>()

const hasUsage = computed(() =>
  props.categories.some((cat) => cat.wordCount > 0 || cat.sessions > 0),
)

// AI apps wear the Auto mark, not a generic bot. `weight` is for the Phosphor
// icons it sits beside; the size comes in as a fallthrough class.
const AutoMark: Component = (_props, { attrs }) => {
  const { weight: _weight, ...rest } = attrs
  return h(AppLogo, { ...rest, sizeClass: '', alt: '' })
}

const icons: Record<UsageCategoryId, Component> = {
  ai: AutoMark,
  other: PhInfinity,
  documents: PhFileText,
  personal: PhChatCircle,
  work: PhBriefcase,
  email: PhEnvelopeSimple,
}

function barTone(index: number): string {
  const opacities = [1, 0.78, 0.58, 0.42, 0.3, 0.18]
  return `color-mix(in srgb, var(--veenna-accent) ${Math.round((opacities[index] ?? 0.2) * 100)}%, transparent)`
}
</script>

<template>
  <div :class="[veennaUi.settingsCard, 'flex h-full flex-col']">
    <div :class="veennaUi.settingsGroupHeader">
      <h3 :class="veennaUi.settingsGroupLabel">Desktop usage</h3>
      <span class="text-caption tabular-nums text-veenna-muted">
        {{ totalApps || categories.filter((c) => c.wordCount > 0).length }} apps
      </span>
    </div>

    <ul v-if="hasUsage" class="flex flex-1 flex-col justify-center gap-3.5 px-4 py-4">
      <li
        v-for="(cat, index) in categories"
        :key="cat.id"
        class="grid grid-cols-[1.25rem_1fr_auto] items-center gap-2.5"
      >
        <component
          :is="icons[cat.id]"
          class="h-4 w-4 text-veenna-icon-muted"
          weight="duotone"
          aria-hidden="true"
        />
        <div class="min-w-0">
          <div class="relative h-7 overflow-hidden rounded-md bg-veenna-row">
            <div
              class="absolute inset-y-0 left-0 flex items-center rounded-md px-2 transition-[width] duration-700 ease-out"
              :style="{
                width: `${Math.max(cat.percent > 0 ? 12 : 0, cat.percent)}%`,
                background: barTone(index),
              }"
            >
              <span
                v-if="cat.percent >= 12"
                class="truncate text-label font-semibold tabular-nums text-veenna-accent-fg"
              >
                {{ cat.percent }}% {{ cat.label }}
              </span>
            </div>
            <span
              v-if="cat.percent > 0 && cat.percent < 12"
              class="absolute inset-y-0 left-2 flex items-center text-label font-medium text-veenna-muted"
            >
              {{ cat.percent }}%
            </span>
          </div>
        </div>
        <p
          class="w-[7.5rem] text-right text-micro font-semibold uppercase tracking-overline text-veenna-muted"
        >
          {{ cat.sessions }}
          {{ cat.countLabel }}
        </p>
      </li>
    </ul>
    <p v-else class="flex flex-1 items-center px-4 py-4 text-body text-veenna-muted">
      Dictate into another app with veenna running to see desktop usage by category.
    </p>

    <p class="border-t border-veenna-divider px-4 py-2.5 text-caption text-veenna-muted">
      Share of dictated words by app category
    </p>
  </div>
</template>
