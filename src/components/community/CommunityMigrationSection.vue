<script setup lang="ts">
import { ref } from 'vue'
import { VeennaButton } from '@/components/veenna'
import { useToast } from '@/components/ui/toast/use-toast'
import { veennaUi } from '@/lib/veennaUi'
import { exportVeennaPack } from '@/lib/community/veennaPack'
import { GO_PRO_URL } from '@/lib/platform/edition'
import { getVeennaElectron } from '@/lib/platform/isElectron'

const { toast } = useToast()
const busy = ref(false)

async function exportDictations() {
  if (busy.value) return
  busy.value = true
  try {
    const result = await exportVeennaPack()
    if (result.ok) {
      const parts: string[] = []
      if (result.captureCount) {
        parts.push(`${result.captureCount} ${result.captureCount === 1 ? 'dictation' : 'dictations'}`)
      }
      if (result.todoCount) {
        parts.push(`${result.todoCount} ${result.todoCount === 1 ? 'task' : 'tasks'}`)
      }
      toast({
        title: 'Ready for Veenna Pro',
        description: `${parts.join(' and ')} saved to Documents/Veenna Migration. Veenna Pro offers to import them on first launch.`,
      })
    } else {
      toast({ title: 'Could not export', description: result.message, variant: 'destructive' })
    }
  } finally {
    busy.value = false
  }
}

async function goPro() {
  const opened = await getVeennaElectron()?.openExternalUrl?.(GO_PRO_URL)
  if (!opened?.ok) window.open(GO_PRO_URL, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <section :class="veennaUi.settingsCard" data-testid="community-migration">
    <p :class="veennaUi.settingsGroupTitle">Move to Veenna Pro</p>
    <div :class="veennaUi.settingsRows">
      <div :class="['flex items-start justify-between gap-4', veennaUi.settingsRow]">
        <div class="min-w-0 space-y-0.5">
          <p class="text-body font-medium text-veenna-foreground">Export your dictations and tasks</p>
          <p class="text-caption text-veenna-muted">
            Saves every dictation, its recording and your Todo tasks to a file in Documents/Veenna Migration. After
            you install Veenna Pro, it offers to import them. Tasks need a signed-in Pro account. Nothing is uploaded from here.
          </p>
        </div>
        <VeennaButton variant="secondary" class="shrink-0" :loading="busy" @click="exportDictations">
          Export
        </VeennaButton>
      </div>
      <div :class="['flex items-start justify-between gap-4', veennaUi.settingsRow]">
        <div class="min-w-0 space-y-0.5">
          <p class="text-body font-medium text-veenna-foreground">Get Veenna Pro</p>
          <p class="text-caption text-veenna-muted">
            Opens the download page in your browser.
          </p>
        </div>
        <VeennaButton variant="secondary" class="shrink-0" @click="goPro">Go Pro</VeennaButton>
      </div>
    </div>
  </section>
</template>
