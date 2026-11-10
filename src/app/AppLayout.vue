<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import NavSidebar from '@/app/nav/NavSidebar.vue'
import MobileNavBar from '@/app/nav/MobileNavBar.vue'
import AppBackground from '@/components/background/AppBackground.vue'
import DictationTopTabs from '@/components/dictation/DictationTopTabs.vue'
import DictationOverlay from '@/components/dictation/DictationOverlay.vue'
import PaneResizeHandle from '@/components/ui/PaneResizeHandle.vue'
import { useThemeStore } from '@/stores/theme'
import { useVoiceCapturesStore } from '@/stores/voiceCaptures'
import { useVoiceSettingsStore } from '@/stores/voiceSettings'
import { useVeennaAnalyticsStore } from '@/stores/veennaAnalytics'
import { useDictationHotkeys } from '@/composables/useDictationHotkeys'
import { useVoiceElectronBridge } from '@/composables/useVoiceElectronBridge'
import { useInputMonitoringNotice } from '@/composables/useInputMonitoringNotice'
import { useElectronSettingsBridge } from '@/composables/useElectronSettingsBridge'
import { useResponsiveLayout } from '@/composables/useResponsiveLayout'
import { useNavSidebarChrome } from '@/composables/useNavSidebarChrome'
import { getVeennaElectron, isDictationHudWindow, isElectronMacMainWindow } from '@/lib/platform/isElectron'
import { isDictationPath } from '@/config/dictationTabs'
import { ROUTES } from '@/router/paths'

/**
 * The Veenna Community shell: a sidebar, the page, and the dictation overlay.
 * There is no account, workspace, chat or any cloud behind it.
 */
const route = useRoute()
const theme = useThemeStore()
const voiceStore = useVoiceCapturesStore()
const analyticsStore = useVeennaAnalyticsStore()

const { isMobile, navOpen, closeNav } = useResponsiveLayout()
const {
  collapsed: navCollapsed,
  docked: navDocked,
  widthStyle: navWidthStyle,
  resizing: navResizing,
  startResize: startNavResize,
  resetWidth: resetNavWidth,
} = useNavSidebarChrome()

const isDictationRoute = computed(() => isDictationPath(route.path))
const isHomeRoute = computed(() => route.path === ROUTES.home || route.name === 'home')

// The dictation HUD window loads its own page; everything else listens here.
const useInAppDictation = !isDictationHudWindow
if (useInAppDictation) {
  useDictationHotkeys()
  useVoiceElectronBridge()
  useInputMonitoringNotice()
}
useElectronSettingsBridge()

function refreshInsights(payload?: { capture?: { id?: string } }) {
  if (!payload?.capture?.id) return
  analyticsStore.scheduleRefresh()
}

let stopVoiceDataSync: (() => void) | void
let stopLocalVoiceData: (() => void) | void

onMounted(() => {
  // What dictation needs, all from this device. Each is allowed to fail on its own.
  const load = (run: () => unknown) => Promise.resolve().then(run).catch(() => undefined)
  void load(() => voiceStore.ensureLocalCapturesHydrated())
  void load(() => useVoiceSettingsStore().load())

  // Dictation in this window.
  if (!isDictationHudWindow) {
    const onLocalVoiceData = (event: Event) => {
      refreshInsights((event as CustomEvent).detail)
    }
    window.addEventListener('veenna-voice-data-changed', onLocalVoiceData)
    stopLocalVoiceData = () => window.removeEventListener('veenna-voice-data-changed', onLocalVoiceData)
  }

  // Dictation from the HUD window arrives here; merge it at once.
  if (!isDictationHudWindow) {
    stopVoiceDataSync = getVeennaElectron()?.onVoiceDataChanged?.((payload) => {
      const audioId = payload?.audioCaptureId || payload?.capture?.id
      if (payload?.audioSaving && audioId) {
        voiceStore.setAudioSaving(audioId, true)
        voiceStore.watchCaptureAudio(audioId)
      }
      if (payload?.capture?.id && payload.capture.text) {
        voiceStore.upsertCaptureOptimistic(payload.capture)
        if (payload.capture.hasAudio) {
          voiceStore.setAudioSaving(payload.capture.id, false)
        } else if (!payload.audioSaving) {
          voiceStore.watchCaptureAudio(payload.capture.id)
        }
      } else if (payload?.audioSaving === false && audioId) {
        void voiceStore.reconcileCaptureAudioFlags([audioId])
        voiceStore.setAudioSaving(audioId, false)
      }
      refreshInsights(payload)
    })
  }
})

onUnmounted(() => {
  stopVoiceDataSync?.()
  stopLocalVoiceData?.()
})
</script>

<template>
  <div
    class="veenna-app-frame relative flex h-full min-h-0 flex-col overflow-hidden text-veenna-fg safe-bottom"
    :class="{
      'bg-veenna-bg': !theme.hasBackground,
      'veenna-with-wallpaper bg-transparent': theme.hasBackground,
      'electron-frame': isElectronMacMainWindow,
      'veenna-app-frame--nav-docked': navDocked,
    }"
    :style="{ fontFamily: 'var(--veenna-font)' }"
  >
    <AppBackground />

    <div class="veenna-app-body relative z-[1] flex min-h-0 flex-1 flex-col">
      <div class="relative flex min-h-0 flex-1">
        <button
          v-if="isMobile && navOpen"
          type="button"
          class="fixed inset-0 z-[90] bg-black/50 lg:hidden"
          aria-label="Close navigation"
          @click="closeNav()"
        />

        <NavSidebar
          class="veenna-nav-sidebar veenna-pane shrink-0 transition-transform duration-300 ease-out"
          :class="[
            navDocked
              ? 'relative z-auto h-full translate-x-0'
              : 'fixed inset-y-0 left-0 z-[100] w-[min(17rem,80vw)] !rounded-none opacity-100 shadow-2xl safe-bottom safe-top',
            !navDocked && !navOpen ? '-translate-x-full' : 'translate-x-0',
            navDocked && navCollapsed ? 'veenna-nav-sidebar--collapsed' : '',
          ]"
          :style="navDocked ? navWidthStyle : undefined"
        />
        <PaneResizeHandle
          v-if="navDocked"
          :active="navResizing"
          @pointerdown="startNavResize"
          @dblclick="resetNavWidth"
        />

        <div class="relative flex min-h-0 min-w-0 flex-1">
          <div class="veenna-main-workbench relative flex min-h-0 min-w-0 flex-1 flex-col">
            <main
              data-dock-main
              class="veenna-main-chrome veenna-pane relative flex h-full min-h-0 min-w-0 flex-1 flex-col"
              :class="[navDocked ? '' : 'veenna-main-chrome--mobile-fab', isHomeRoute ? 'veenna-main-chrome--home' : '']"
            >
              <MobileNavBar v-if="!navDocked" />
              <div class="veenna-main-scroll relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
                <DictationTopTabs v-if="isDictationRoute" />
                <div class="relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div class="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    <RouterView v-slot="{ Component }">
                      <component :is="Component" v-if="Component" :key="route.path" />
                    </RouterView>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>

    <DictationOverlay v-if="useInAppDictation" />
  </div>
</template>
