<template>
  <RouterView />
  <AppConfirmDialog v-if="showsAppChrome" />
  <Toaster v-if="showsAppChrome" />
  <ZoomIndicator v-if="showsAppChrome" />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AppConfirmDialog from '@/components/app/AppConfirmDialog.vue'
import Toaster from '@/components/ui/toast/Toaster.vue'
import ZoomIndicator from '@/components/app/ZoomIndicator.vue'
import { useReducedMotion } from '@/composables/useReducedMotion'
import { initLocalStoreLifecycle } from '@/composables/useLocalStoreLifecycle'
import { isDictationHudWindow } from '@/lib/platform/isElectron'
import { startInAppDictationInsertReceiver } from '@/lib/dictation/inAppDictationInsert'
import { validateStoredPhotoBackgrounds } from '@/lib/photoBackgroundValidation'
import { scheduleIdleWork } from '@/lib/scheduleIdleWork'

useReducedMotion()
/** Toasts and dialogs belong to the main window only; the small HUD window stays clear. */
const showsAppChrome = !isDictationHudWindow

onMounted(() => {
  if (isDictationHudWindow) return
  startInAppDictationInsertReceiver()
  // Local-store opening asks the main process to perform SQLite work. Give the
  // freshly painted shell a short interaction window before asking for it.
  scheduleIdleWork(
    () => {
      initLocalStoreLifecycle()
      void validateStoredPhotoBackgrounds()
    },
    { delayMs: 1200, timeoutMs: 3000 },
  )
})
</script>
