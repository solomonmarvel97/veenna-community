<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onMounted,
  ref,
  watch,
  type AsyncComponentLoader,
} from 'vue'
import { useRoute } from 'vue-router'
import AppPageShell from '@/components/app/AppPageShell.vue'
import SidebarToggleIcon from '@/components/ui/SidebarToggleIcon.vue'
import PaneResizeHandle from '@/components/ui/PaneResizeHandle.vue'
import AuthThemeToggle from '@/components/auth/AuthThemeToggle.vue'
import SettingsSidebarNav from '@/components/settings/SettingsSidebarNav.vue'
import { PaneFooter } from '@/components/veenna'
import SettingsGeneralPanel from '@/components/settings/SettingsGeneralPanel.vue'
import SettingsPanelSkeleton from '@/components/settings/SettingsPanelSkeleton.vue'
import { settingsTabLabel } from '@/components/settings/settingsTabs'
import { useSettings } from '@/composables/useSettings'
import { useResponsiveLayout } from '@/composables/useResponsiveLayout'
import { usePersistedSidebarWidth } from '@/composables/usePersistedSidebarWidth'
import { SETTINGS_MENU_PANE } from '@/lib/paneLayout'
import { APP_VERSION_LABEL } from '@/config/app'
import { warmSettingsPanels } from '@/lib/settingsWarmup'
import { parseSettingsTabQuery } from '@/router/query'
import { QUERY } from '@/router/paths'

/**
 * Each page is its own chunk. If one is slow to arrive, the pane shows that
 * page's shape instead of sitting blank.
 */
const lazyPanel = (loader: AsyncComponentLoader) =>
  defineAsyncComponent({ loader, loadingComponent: SettingsPanelSkeleton })

const SettingsSystemPanel = lazyPanel(() => import('@/components/settings/SettingsSystemPanel.vue'))
const SettingsPermissionsPanel = lazyPanel(
  () => import('@/components/settings/SettingsPermissionsPanel.vue'),
)
const SettingsAppearancePanel = lazyPanel(
  () => import('@/components/settings/SettingsAppearancePanel.vue'),
)
const SettingsDictationPanel = lazyPanel(
  () => import('@/components/settings/SettingsDictationPanel.vue'),
)
const SettingsSpeechModelsPanel = lazyPanel(
  () => import('@/components/settings/SettingsSpeechModelsPanel.vue'),
)

const route = useRoute()
const { activeTab, syncSettingsTab } = useSettings()
const { isMobile } = useResponsiveLayout()

/**
 * The page is always the settings themselves. The menu is a pane of its own beside them, the way
 * Notes keeps its list: open on a desktop, a drawer over the page on a phone (closed until asked
 * for, and folded away again once a section is picked).
 */
const navOpen = ref(!isMobile.value)

watch(isMobile, (mobile) => {
  navOpen.value = !mobile
})

watch(activeTab, () => {
  if (isMobile.value) navOpen.value = false
})

const {
  width: menuWidth,
  resizing: menuResizing,
  startResize: startMenuResize,
  resetWidth: resetMenuWidth,
  setWidth: setMenuWidth,
} = usePersistedSidebarWidth({ ...SETTINGS_MENU_PANE })

/** Pulled this far past its narrowest, or off its seam, the menu folds away; pulled out this far it opens. */
const SEAM_FLING_PX = 40
/** A press that moves less than this is a click. */
const SEAM_CLICK_PX = 4

/**
 * The line between the menu and the page does all of it: drag to resize, drag the menu in past its
 * narrowest to fold it away, drag out from a folded menu (or click the line) to open it again.
 */
function onSeamPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  const wasOpen = navOpen.value
  const startX = event.clientX
  const startWidth = menuWidth.value
  let travelled = 0
  let lastX = startX
  if (wasOpen) startMenuResize(event)
  else event.preventDefault()

  const onMove = (move: PointerEvent) => {
    lastX = move.clientX
    travelled = Math.max(travelled, Math.abs(lastX - startX))
  }
  const onEnd = () => {
    window.removeEventListener('pointermove', onMove, true)
    window.removeEventListener('pointerup', onEnd, true)
    window.removeEventListener('pointercancel', onEnd, true)
    const delta = lastX - startX
    if (travelled < SEAM_CLICK_PX) navOpen.value = !wasOpen
    else if (wasOpen && startWidth + delta < SETTINGS_MENU_PANE.minWidth - SEAM_FLING_PX) {
      navOpen.value = false
      // The drag squeezed the saved width down to the narrowest: bring back what it was, to open at.
      setMenuWidth(startWidth)
    } else if (!wasOpen && delta > SEAM_FLING_PX) navOpen.value = true
  }
  window.addEventListener('pointermove', onMove, true)
  window.addEventListener('pointerup', onEnd, true)
  window.addEventListener('pointercancel', onEnd, true)
}

/** The address names the tab, so a link, a reload and Back all land on the same one. */
watch(
  () => route.query[QUERY.tab],
  () => syncSettingsTab(parseSettingsTabQuery(route.query)),
)

/**
 * Which panel is "current". Panels mount the first time they are shown and
 * stay (KeepAlive), so a tab switch back never re-fetches or flashes loading,
 * and a visit to Settings only pays for the tabs actually opened.
 */
const panel = computed(() => {
  switch (activeTab.value) {
    case 'models':
      return SettingsSpeechModelsPanel
    case 'system':
      return SettingsSystemPanel
    case 'permissions':
      return SettingsPermissionsPanel
    case 'appearance':
      return SettingsAppearancePanel
    case 'dictation':
      return SettingsDictationPanel
    default:
      return SettingsGeneralPanel
  }
})

const heading = computed(() => settingsTabLabel(activeTab.value))

onMounted(() => {
  syncSettingsTab(parseSettingsTabQuery(route.query))
  // Now that they are in here, a tab click should not wait on a chunk either.
  warmSettingsPanels()
})
</script>

<template>
  <AppPageShell fill hide-breadcrumb hide-top-search frosted>
    <div
      class="veenna-agent-shell veenna-productivity-shell relative flex h-full min-h-0 flex-1 overflow-hidden"
    >
      <!-- Phone: the menu drawer floats over the page, so the page behind it dims. -->
      <Transition name="fade">
        <button
          v-if="navOpen && isMobile"
          type="button"
          class="fixed inset-0 z-20 bg-black/40"
          aria-label="Close settings menu"
          @click="navOpen = false"
        />
      </Transition>

      <aside
        v-if="navOpen"
        class="veenna-notes-sidebar veenna-frame-card no-drag flex h-full flex-col bg-veenna-surface transition-transform duration-200 dark:bg-veenna-bg"
        :class="
          isMobile
            ? 'absolute inset-y-0 left-0 z-30 w-[min(88vw,20rem)] shadow-2xl'
            : 'relative z-[6] shrink-0'
        "
        :style="isMobile ? undefined : { width: `${menuWidth}px` }"
      >
        <div
          class="draggable-region relative z-[6] flex h-11 shrink-0 items-center gap-1 border-b border-veenna-divider pl-3 pr-2"
        >
          <span
            class="min-w-0 flex-1 truncate text-label font-medium uppercase tracking-overline text-veenna-muted"
            >Settings</span
          >
          <button
            type="button"
            class="no-drag inline-flex h-7 w-7 shrink-0 items-center justify-center text-veenna-icon-muted transition-colors hover:text-veenna-fg focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--veenna-focus-subtle)]"
            aria-label="Collapse settings menu"
            title="Hide settings menu"
            aria-expanded="true"
            @click="navOpen = false"
          >
            <SidebarToggleIcon class="h-4 w-4" :open="true" />
          </button>
        </div>
        <SettingsSidebarNav />
        <!-- Same row as the main sidebar's footer (PaneFooter), so the two line up. -->
        <PaneFooter class="shrink-0 justify-between px-3 text-caption text-veenna-muted">
          <span>veenna {{ APP_VERSION_LABEL }}</span>
          <AuthThemeToggle />
        </PaneFooter>
      </aside>

      <!-- The seam: resize, fold or open the menu. Kept when the menu is folded so the line can bring it back. -->
      <PaneResizeHandle
        v-if="!isMobile"
        class="hidden md:block"
        :active="menuResizing"
        :hint="
          navOpen
            ? 'Drag to resize · click to collapse · double-click to reset'
            : 'Click or drag to open the menu'
        "
        @pointerdown="onSeamPointerDown"
        @dblclick="navOpen && resetMenuWidth()"
      />

      <section
        class="veenna-notes-page veenna-frame-card no-drag relative z-[6] flex h-full min-h-0 min-w-0 flex-1 flex-col"
      >
        <header
          class="draggable-region flex h-11 shrink-0 items-center gap-3 border-b border-veenna-divider px-4 sm:px-6"
        >
          <button
            v-if="!navOpen"
            type="button"
            class="no-drag inline-flex h-7 w-7 shrink-0 items-center justify-center text-veenna-icon-muted transition-colors hover:text-veenna-fg focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--veenna-focus-subtle)]"
            aria-label="Open settings menu"
            title="Show settings menu"
            aria-expanded="false"
            @click="navOpen = true"
          >
            <SidebarToggleIcon class="h-4 w-4" :open="false" />
          </button>
          <h1 class="heading-display min-w-0 flex-1 truncate text-title text-veenna-fg">
            {{ heading }}
          </h1>
        </header>

        <div class="veenna-scroll-hidden min-h-0 flex-1 overflow-y-auto">
          <!-- One column for every page: the same left edge and the same width, whatever the page holds. -->
          <div class="mx-auto w-full min-w-0 max-w-4xl px-4 py-5 sm:px-6" data-settings-panel>
            <KeepAlive>
              <component :is="panel" v-if="panel" :key="activeTab" />
            </KeepAlive>
          </div>
        </div>
      </section>
    </div>
  </AppPageShell>
</template>
