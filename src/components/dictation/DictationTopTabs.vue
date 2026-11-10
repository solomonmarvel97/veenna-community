<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DICTATION_TABS, type DictationTab } from '@/config/dictationTabs'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { veennaUi } from '@/lib/veennaUi'

const route = useRoute()
const router = useRouter()
const tabs = DICTATION_TABS

function isActive(tab: DictationTab) {
  return route.path === tab.path || route.path.startsWith(`${tab.path}/`)
}

const activeId = computed(() => tabs.find(isActive)?.id ?? '')

function open(id: string | number) {
  const tab = tabs.find((t) => t.id === id)
  if (tab && !isActive(tab)) void router.push(tab.path)
}

</script>

<template>
  <div
    class="dictation-top-tabs productivity-top-tabs no-drag flex h-[80px] shrink-0 items-center border-b border-veenna-divider max-lg:h-auto max-lg:items-stretch"
  >
    <Tabs
      :model-value="activeId"
      activation-mode="manual"
      :class="cn(veennaUi.pageColumn, 'min-w-0 py-1')"
      @update:model-value="open"
    >
      <TabsList aria-label="Dictation" class="w-auto max-w-full self-start">
        <TabsTrigger
          v-for="tab in tabs"
          :key="tab.id"
          :value="tab.id"
          :show-check="false"
          class="flex-none"
        >
          <component
            :is="tab.icon"
            class="h-3.5 w-3.5 shrink-0"
            :weight="isActive(tab) && !tab.outlineOnly ? 'fill' : 'regular'"
            aria-hidden="true"
          />
          <span>{{ tab.label }}</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  </div>
</template>
