<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useToast } from './use-toast'
import Toast from './Toast.vue'
import { BROWSER_TOAST_HOST_ID } from '@/lib/browserToastHost'
import { isElectronMacMainWindow } from '@/lib/platform/isElectron'
import { Z_INDEX_TOAST } from '@/composables/useZIndexManager'

const { toasts, dismiss, pause, resume } = useToast()
const browserHostPresent = ref(false)
let hostObserver: MutationObserver | null = null

const MAIN_VIEW_SELECTOR = 'main.veenna-main-chrome'
const mainInsets = ref<{ left: number; right: number } | null>(null)
let mainResizeObserver: ResizeObserver | null = null
let observedMain: Element | null = null

function refreshMainInsets() {
  const main = document.querySelector(MAIN_VIEW_SELECTOR)
  if (main !== observedMain) {
    mainResizeObserver?.disconnect()
    observedMain = main
    if (main) mainResizeObserver?.observe(main)
  }
  if (!main) {
    mainInsets.value = null
    return
  }
  const rect = main.getBoundingClientRect()
  const left = Math.max(0, Math.round(rect.left))
  const right = Math.max(0, Math.round(window.innerWidth - rect.right))
  const prev = mainInsets.value
  if (!prev || prev.left !== left || prev.right !== right) mainInsets.value = { left, right }
}

const containerStyle = computed(() =>
  mainInsets.value
    ? {
        zIndex: Z_INDEX_TOAST,
        left: `${mainInsets.value.left}px`,
        right: `${mainInsets.value.right}px`,
      }
    : { zIndex: Z_INDEX_TOAST },
)

function refreshBrowserHost() {
  browserHostPresent.value = Boolean(document.getElementById(BROWSER_TOAST_HOST_ID))
  refreshMainInsets()
}

onMounted(() => {
  mainResizeObserver = new ResizeObserver(() => refreshMainInsets())
  window.addEventListener('resize', refreshMainInsets)
  refreshBrowserHost()
  // Fires after every DOM change on the page, so it only does the cheap
  // lookups. The rectangle is read (a layout, mid-render) only when the browser
  // host came or went, or the main view was swapped; its size is the
  // ResizeObserver's job.
  hostObserver = new MutationObserver(() => {
    const hostPresent = Boolean(document.getElementById(BROWSER_TOAST_HOST_ID))
    const main = document.querySelector(MAIN_VIEW_SELECTOR)
    if (hostPresent === browserHostPresent.value && main === observedMain) return
    refreshBrowserHost()
  })
  hostObserver.observe(document.body, { childList: true, subtree: true })
})

onBeforeUnmount(() => {
  mainResizeObserver?.disconnect()
  mainResizeObserver = null
  observedMain = null
  window.removeEventListener('resize', refreshMainInsets)
  hostObserver?.disconnect()
  hostObserver = null
})

const useBrowserHost = computed(() => browserHostPresent.value)
const toastTarget = computed(() => (useBrowserHost.value ? `#${BROWSER_TOAST_HOST_ID}` : 'body'))
</script>

<template>
  <Teleport :to="toastTarget">
    <div
      data-toaster-container
      class="pointer-events-none flex flex-col items-center gap-2"
      :class="
        useBrowserHost
          ? 'browser-toast-host h-full justify-center px-2'
          : [
              mainInsets ? 'fixed top-0 px-4' : 'fixed inset-x-0 top-0 px-4',
              isElectronMacMainWindow
                ? 'pt-[calc(var(--veenna-electron-titlebar,32px)+0.5rem)]'
                : 'pt-[max(0.75rem,env(safe-area-inset-top))]',
            ]
      "
      :style="useBrowserHost ? undefined : containerStyle"
    >
      <TransitionGroup name="toast">
        <Toast
          v-for="t in toasts"
          :key="t.id"
          :title="t.title"
          :description="t.description"
          :variant="t.variant"
          :icon="t.icon"
          :on-click="t.onClick"
          :on-click-hint="t.onClickHint"
          :action-label="t.actionLabel"
          :on-action="
            () => {
              t.onAction?.()
              dismiss(t.id)
            }
          "
          :action-hint="t.actionHint"
          @dismiss="dismiss(t.id)"
          @mouseenter="pause(t.id)"
          @mouseleave="resume(t.id)"
        />
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-0.5rem);
}

.browser-toast-host :deep(.pointer-events-auto) {
  padding-top: 0.125rem;
  padding-bottom: 0.125rem;
}
</style>
