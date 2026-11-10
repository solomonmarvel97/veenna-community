<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NavPlanBadge from './NavPlanBadge.vue'
import NavDictationSection from './NavDictationSection.vue'
import NavTodoSection from './NavTodoSection.vue'
import NavDictationButton from './NavDictationButton.vue'
import CommunityGoPro from './CommunityGoPro.vue'
import NavHistoryArrows from './NavHistoryArrows.vue'
import NavSidebarToggle from './NavSidebarToggle.vue'
import AppLogo from '@/components/app/AppLogo.vue'
import MobileNavDrawerHeader from '@/app/nav/MobileNavDrawerHeader.vue'
import { NavItem, NavIconTile, PaneFooter, VeennaPane } from '@/components/veenna'
import { productNavHomeItem } from '@/config/productNav'
import { veennaUi } from '@/lib/veennaUi'
import { isElectronMacMainWindow, isDictationHudWindow } from '@/lib/platform/isElectron'
import { useNavSidebarChrome } from '@/composables/useNavSidebarChrome'
import { useResponsiveLayout } from '@/composables/useResponsiveLayout'

/**
 * The Veenna Community sidebar: Home, Dictation and Todo, the mic, Settings and Go Pro.
 * There is no account, chat, work mode or anything else behind it.
 */
const route = useRoute()
const router = useRouter()
const { closeNav } = useResponsiveLayout()
const { iconRail: navCollapsed, docked: navDocked, width: navWidth } = useNavSidebarChrome()

/** The title strip holds the traffic lights and the arrows; narrow, the arrows shrink. */
const stripCompact = computed(() => navWidth.value < 200)
const homeActive = computed(() => route.path === productNavHomeItem.path)
const showDictationButton = !isDictationHudWindow

function openHome() {
  closeNav()
  void router.push(productNavHomeItem.path)
}
</script>

<template>
  <VeennaPane class="h-full min-h-0">
    <div
      v-if="isElectronMacMainWindow"
      class="veenna-sidebar-titlebar relative shrink-0"
      :class="navCollapsed && 'veenna-sidebar-titlebar--rail'"
    >
      <template v-if="!navCollapsed">
        <AppLogo
          size-class="h-6 w-6"
          alt=""
          class="absolute left-3 top-[24px] z-10 -translate-y-1/2 lg:hidden"
        />
        <NavHistoryArrows
          :compact="stripCompact"
          class="absolute right-[44px] top-[24px] z-10 -translate-y-1/2 lg:right-3"
        />
        <NavSidebarToggle
          class="no-drag absolute right-3 top-[24px] z-10 -translate-y-1/2 lg:hidden"
        />
      </template>
    </div>
    <MobileNavDrawerHeader v-if="!navDocked" />

    <NavPlanBadge />

    <div :class="[veennaUi.scrollHidden, 'flex min-h-0 flex-1 flex-col']">
      <div
        class="flex flex-col gap-[1.5px] px-2 pt-0.5 pb-1 [&_[data-nav-item]:not([data-active]):hover]:bg-transparent [&_[data-nav-item]:not([data-active]):hover]:opacity-75"
      >
        <NavItem
          :class="veennaUi.navRow"
          variant="smart"
          :active="homeActive"
          @click="openHome"
        >
          <template #icon>
            <NavIconTile
              :icon="productNavHomeItem.icon"
              :color="productNavHomeItem.iconTile"
              variant="glyph"
              class="!size-4"
            />
          </template>
          {{ productNavHomeItem.label }}
        </NavItem>
        <NavDictationSection />
        <NavTodoSection />
      </div>
    </div>

    <NavDictationButton v-if="showDictationButton" />

    <div class="shrink-0 border-t border-veenna-divider">
      <PaneFooter
        class="min-w-0 shrink-0 justify-between gap-2 px-3 !border-t-0"
        :class="navCollapsed && 'justify-center px-1'"
      >
        <CommunityGoPro />
      </PaneFooter>
    </div>
  </VeennaPane>
</template>
