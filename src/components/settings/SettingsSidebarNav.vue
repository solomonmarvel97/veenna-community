<script setup lang="ts">
import { visibleSettingsTabs, resolveSettingsTab } from '@/components/settings/settingsTabs'
import { useSettings } from '@/composables/useSettings'
import { isElectron } from '@/lib/platform/isElectron'
import type { SettingsTab } from '@/router/paths'
import { NavIconTile, NavItem } from '@/components/veenna'
import { veennaUi } from '@/lib/veennaUi'

const modal = useSettings()
const activeTab = modal.activeTab
const tabs = visibleSettingsTabs(isElectron)

function selectTab(tab: SettingsTab) {
  void modal.setSettingsTab(resolveSettingsTab(tab, isElectron))
  modal.showSettingsDetail()
}
</script>

<template>
  <aside class="flex min-h-0 w-full flex-1 flex-col">
    <nav
      class="veenna-scroll-hidden min-h-0 flex-1 overflow-y-auto p-2 [&_[data-nav-item]]:bg-transparent [&_[data-nav-item]:not([data-active])]:text-veenna-muted [&_[data-nav-item]:not([data-active]):hover]:text-veenna-fg"
      aria-label="Settings sections"
    >
      <ul class="flex flex-col gap-[1.5px]">
        <li v-for="tab in tabs" :key="tab.id">
          <NavItem
            :class="veennaUi.navRow"
            variant="smart"
            :active="activeTab === tab.id"
            :aria-current="activeTab === tab.id ? 'page' : undefined"
            @click="selectTab(tab.id)"
          >
            <template #icon>
              <NavIconTile :icon="tab.icon" :color="tab.iconTile" variant="glyph" class="!size-4" />
            </template>
            {{ tab.label }}
          </NavItem>
        </li>
      </ul>
    </nav>
  </aside>
</template>
