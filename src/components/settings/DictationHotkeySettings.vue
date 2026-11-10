<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useVoiceSettingsStore } from '@/stores/voiceSettings'
import { VeennaButton } from '@/components/veenna'
import AnimatedDots from '@/components/ui/AnimatedDots.vue'
import { dictationKeyLabel } from '@/lib/dictation/dictationHotkey'
import { isElectron } from '@/lib/platform/isElectron'
import {
  formatVoiceHotkey,
  hotkeyFromKeyboardEvent,
  validateVoiceHotkey,
} from '@/lib/voice/voiceHotkeyUtils'
import { veennaUi } from '@/lib/veennaUi'
import type { VoiceHotkey } from '@/types/electron'
import { useToast } from '@/components/ui/toast/use-toast'
import SettingsRowTitle from '@/components/settings/SettingsRowTitle.vue'

const voiceSettings = useVoiceSettingsStore()
const { toast } = useToast()

const recording = ref(false)
const saving = ref(false)
const draftHotkey = ref<VoiceHotkey | null>(null)

const pttLabel = computed(() => dictationKeyLabel())
const currentLabel = computed(() =>
  formatVoiceHotkey(voiceSettings.settings?.hotkey as VoiceHotkey | null),
)
const draftLabel = computed(() => (draftHotkey.value ? formatVoiceHotkey(draftHotkey.value) : ''))

async function persistHotkey(hotkey: VoiceHotkey | null) {
  if (!isElectron) return
  saving.value = true
  try {
    await voiceSettings.update({ hotkey })
    const result = await window.veennaElectron?.registerHotkey?.(hotkey ?? null)
    if (result && !result.ok && !result.cleared) {
      toast({
        title: 'Shortcut not registered',
        description:
          result.reason === 'registration_failed'
            ? 'That shortcut may be used by another app. Try a different combination.'
            : 'Could not register the shortcut.',
        variant: 'destructive',
      })
    }
    draftHotkey.value = null
  } finally {
    saving.value = false
  }
}

function startRecording() {
  recording.value = true
  draftHotkey.value = null
  window.addEventListener('keydown', onCaptureKeydown, true)
}

function stopRecording() {
  recording.value = false
  window.removeEventListener('keydown', onCaptureKeydown, true)
}

async function onCaptureKeydown(event: KeyboardEvent) {
  event.preventDefault()
  event.stopPropagation()

  if (event.key === 'Escape') {
    stopRecording()
    return
  }

  const hotkey = hotkeyFromKeyboardEvent(event)
  if (!hotkey) return

  const validationError = validateVoiceHotkey(hotkey)
  if (validationError) {
    toast({ title: 'Invalid shortcut', description: validationError, variant: 'destructive' })
    return
  }

  stopRecording()
  draftHotkey.value = hotkey
  await persistHotkey(hotkey)
}

async function clearHotkey() {
  stopRecording()
  draftHotkey.value = null
  await persistHotkey(null)
}

onMounted(() => {
  void voiceSettings.load()
})

onUnmounted(() => {
  stopRecording()
})
</script>

<template>
  <section :class="veennaUi.settingsCard">
    <div :class="veennaUi.settingsRows">
      <div :class="veennaUi.settingsRow">
        <div class="space-y-0.5">
          <p class="text-body font-medium text-veenna-foreground">Push-to-talk</p>
          <p class="text-caption text-veenna-muted">
            Hold <span class="font-medium text-veenna-foreground">{{ pttLabel }}</span> to dictate and
            paste. Release to finish. Press
            <span class="font-medium text-veenna-foreground">{{ pttLabel }} twice</span> for
            hands-free; press it again to finish.
          </p>
        </div>
      </div>

      <div :class="veennaUi.settingsRow">
        <div class="space-y-2">
          <div class="space-y-0.5">
            <SettingsRowTitle
              :hint="`Shortcut to start and stop dictation without holding ${pttLabel}.`"
              >Hands-free toggle</SettingsRowTitle
            >
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <span
              class="inline-flex h-7 min-w-[7.5rem] items-center justify-center rounded-md bg-muted px-3 text-caption font-medium leading-none text-veenna-fg dark:bg-muted/55"
              :aria-label="`Hands-free shortcut: ${draftLabel || currentLabel}`"
            >
              {{ draftLabel || currentLabel }}
            </span>
            <VeennaButton
              variant="muted"
              class="min-w-[7.5rem]"
              :loading="saving"
              @click="startRecording"
            >
              <AnimatedDots v-if="recording" label="Press shortcut" size="sm" />
              <template v-else>Record shortcut</template>
            </VeennaButton>
            <VeennaButton v-if="recording" variant="ghost" @click="stopRecording">Cancel</VeennaButton>
            <VeennaButton
              v-if="voiceSettings.settings?.hotkey && !recording"
              variant="ghost"
              :loading="saving"
              @click="clearHotkey"
            >
              Clear
            </VeennaButton>
          </div>
          <p v-if="recording" class="text-caption text-veenna-muted">
            Press a modifier combo, or click Cancel / press Esc.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
