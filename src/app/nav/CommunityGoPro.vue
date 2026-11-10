<script setup lang="ts">
import { PhArrowUpRight, PhGearSix } from '@phosphor-icons/vue'
import { useRouter } from 'vue-router'
import { ROUTES } from '@/router/paths'
import { GO_PRO_URL } from '@/lib/platform/edition'
import { getVeennaElectron } from '@/lib/platform/isElectron'
import { exportVeennaPack } from '@/lib/community/veennaPack'
import { useNavSidebarChrome } from '@/composables/useNavSidebarChrome'

const { iconRail: navCollapsed } = useNavSidebarChrome()
const router = useRouter()

function openSettings() {
  void router.push(ROUTES.settings)
}

/** Opens the download page in the person's own browser; the app itself sends nothing. */
async function goPro() {
  // Have the migration file ready before they leave, so Veenna Pro can offer to import it.
  // Quiet on purpose: no Finder window, and nothing to tell them if there is nothing to move.
  await exportVeennaPack({ reveal: false }).catch(() => undefined)
  const opener = getVeennaElectron()?.openExternalUrl
  if (opener) {
    const result = await opener(GO_PRO_URL)
    if (result?.ok) return
  }
  window.open(GO_PRO_URL, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div
    class="flex min-w-0 flex-1 items-center justify-between gap-2"
    :class="navCollapsed && 'flex-col justify-center'"
  >
    <button
      type="button"
      class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-veenna-divider text-veenna-fg transition-colors hover:bg-veenna-row focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--veenna-focus-subtle)]"
      title="Settings: speech models and dictation"
      aria-label="Settings"
      data-testid="community-settings"
      @click="openSettings"
    >
      <PhGearSix :size="12" weight="bold" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="inline-flex h-7 min-w-0 items-center justify-center gap-1.5 rounded-md border border-veenna-divider text-body-sm text-veenna-fg transition-colors hover:bg-veenna-row focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--veenna-focus-subtle)]"
      :class="navCollapsed ? 'w-7' : 'px-2.5'"
      title="Go Pro: get the full Veenna app"
      aria-label="Go Pro: get the full Veenna app"
      data-testid="community-go-pro"
      @click="goPro"
    >
      <PhArrowUpRight :size="12" weight="bold" class="shrink-0" aria-hidden="true" />
      <span v-if="!navCollapsed" class="truncate">Go Pro</span>
    </button>
  </div>
</template>
