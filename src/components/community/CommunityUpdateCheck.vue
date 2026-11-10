<script setup lang="ts">
import { ref } from 'vue'
import { VeennaButton } from '@/components/veenna'
import { veennaUi } from '@/lib/veennaUi'
import { getVeennaElectron } from '@/lib/platform/isElectron'


const busy = ref(false)
const summary = ref('')
const downloadUrl = ref('')

/** Runs only when pressed. The app never checks on its own. */
async function check() {
  if (busy.value) return
  busy.value = true
  summary.value = ''
  downloadUrl.value = ''
  try {
    const result = await getVeennaElectron()?.checkCommunityUpdates?.()
    if (!result) {
      summary.value = 'Update checks are only available in the desktop app.'
    } else if (!result.ok) {
      summary.value = result.message
    } else {
      const models = result.newModels.length
        ? ` ${result.newModels.length} newer speech ${result.newModels.length === 1 ? 'model is' : 'models are'} listed (${result.newModels.map((model) => model.label).join(', ')}); they arrive with the update.`
        : ''
      if (result.updateAvailable) {
        summary.value = `Version ${result.latestVersion} is available (you have ${result.currentVersion}).${models}`
        downloadUrl.value = result.pageUrl
      } else {
        summary.value = `You are up to date (${result.currentVersion}).${models}`
      }
    }
  } finally {
    busy.value = false
  }
}

async function openDownload() {
  if (!downloadUrl.value) return
  const opened = await getVeennaElectron()?.openExternalUrl?.(downloadUrl.value)
  if (!opened?.ok) window.open(downloadUrl.value, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div :class="['flex items-start justify-between gap-4', veennaUi.settingsRow]" data-testid="community-update-check">
    <div class="min-w-0 space-y-0.5">
      <p class="text-body font-medium text-veenna-foreground">Check for updates</p>
      <p class="text-caption text-veenna-muted">
        {{ summary || 'Only when you press the button. It reads a signed version file; nothing from your device is sent.' }}
      </p>
    </div>
    <div class="flex shrink-0 gap-2">
      <VeennaButton v-if="downloadUrl" variant="secondary" @click="openDownload">Download</VeennaButton>
      <VeennaButton variant="secondary" :loading="busy" @click="check">Check</VeennaButton>
    </div>
  </div>
</template>
