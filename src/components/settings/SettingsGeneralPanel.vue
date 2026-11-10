<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { VeennaButton } from '@/components/veenna'
import AppPlatformBadge from '@/components/app/AppPlatformBadge.vue'
import AppTextLogo from '@/components/app/AppTextLogo.vue'
import { APP_SLOGAN } from '@/config/appLogo'
import { APP_VERSION_LABEL } from '@/config/app'
import { useToast } from '@/components/ui/toast/use-toast'
import { dictationKeyLabel } from '@/lib/dictation/dictationHotkey'
import { isElectron } from '@/lib/platform/isElectron'
import { useElectron } from '@/composables/useElectron'
import { onPreferredMicDeviceChanged, readPreferredMicDeviceId, writePreferredMicDeviceId } from '@/lib/voice/dictationMicPreference'
import { formatVoiceHotkey, hotkeyFromKeyboardEvent, validateVoiceHotkey } from '@/lib/voice/voiceHotkeyUtils'
import { veennaUi } from '@/lib/veennaUi'
import { useVoiceSettingsStore } from '@/stores/voiceSettings'
import type { VoiceHotkey } from '@/types/electron'
import CommunityMigrationSection from '@/components/community/CommunityMigrationSection.vue'
import CommunityUpdateCheck from '@/components/community/CommunityUpdateCheck.vue'
import { isCommunity } from '@/lib/platform/edition'

const voiceSettings = useVoiceSettingsStore()
const { toast } = useToast()
const { appInfo } = useElectron()

const editingShortcut = ref(false)
const editingMic = ref(false)
const editingLanguage = ref(false)
const recordingHotkey = ref(false)
const savingHotkey = ref(false)
const micDevices = ref<MediaDeviceInfo[]>([])
const preferredMicId = ref<string | null>(readPreferredMicDeviceId())

const hotkeyLabel = computed(() => dictationKeyLabel())
const shortcutSummary = computed(() =>
  formatVoiceHotkey(voiceSettings.settings?.hotkey as VoiceHotkey | null),
)

const languageOptions = [
  { value: 'auto', label: 'Auto' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
] as const

const selectedLanguage = computed(() => voiceSettings.sttLanguage ?? 'auto')

const languageLabel = computed(() => {
  const match = languageOptions.find((option) => option.value === selectedLanguage.value)
  return match?.label ?? 'Auto'
})

const micLabel = computed(() => {
  const preferred = preferredMicId.value
  if (!preferred) return 'System default microphone'
  const device = micDevices.value.find((entry) => entry.deviceId === preferred)
  return device?.label?.trim() || 'Selected microphone'
})


let stopMicListener: (() => void) | undefined

async function loadMicDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    micDevices.value = devices.filter((device) => device.kind === 'audioinput')
  } catch {
    micDevices.value = []
  }
}

async function persistHotkey(hotkey: VoiceHotkey | null) {
  if (!isElectron) return
  savingHotkey.value = true
  try {
    await voiceSettings.update({ hotkey })
    const result = await window.veennaElectron?.registerHotkey?.(hotkey ?? null)
    if (result && !result.ok && !result.cleared) {
      toast({
        title: 'Shortcut not registered',
        description: 'Try a different key combination.',
        variant: 'destructive',
      })
    }
    editingShortcut.value = false
  } finally {
    savingHotkey.value = false
  }
}

function startHotkeyCapture() {
  editingShortcut.value = true
  recordingHotkey.value = true
  window.addEventListener('keydown', onCaptureHotkey, true)
}

function cancelHotkeyCapture() {
  stopHotkeyCapture()
  editingShortcut.value = false
}

function toggleHotkeyCapture() {
  if (recordingHotkey.value || editingShortcut.value) {
    cancelHotkeyCapture()
    return
  }
  startHotkeyCapture()
}

function stopHotkeyCapture() {
  recordingHotkey.value = false
  window.removeEventListener('keydown', onCaptureHotkey, true)
}

async function onCaptureHotkey(event: KeyboardEvent) {
  event.preventDefault()
  event.stopPropagation()

  if (event.key === 'Escape') {
    cancelHotkeyCapture()
    return
  }

  const hotkey = hotkeyFromKeyboardEvent(event)
  if (!hotkey) return

  const validationError = validateVoiceHotkey(hotkey)
  if (validationError) {
    toast({ title: 'Invalid shortcut', description: validationError, variant: 'destructive' })
    return
  }

  stopHotkeyCapture()
  await persistHotkey(hotkey)
}

async function onMicChange(deviceId: string) {
  writePreferredMicDeviceId(deviceId === 'default' ? null : deviceId)
  preferredMicId.value = readPreferredMicDeviceId()
  editingMic.value = false
}

async function onLanguageChange(value: string) {
  await voiceSettings.update({ sttLanguage: value === 'auto' ? null : value })
  editingLanguage.value = false
}

onMounted(() => {
  void voiceSettings.load()
  void loadMicDevices()
  stopMicListener = onPreferredMicDeviceChanged(() => {
    preferredMicId.value = readPreferredMicDeviceId()
  })
})

onUnmounted(() => {
  stopHotkeyCapture()
  stopMicListener?.()
})
</script>

<template>
  <div class="w-full space-y-4">
    <section :class="veennaUi.settingsCard">
      <p :class="veennaUi.settingsGroupTitle">About</p>
      <div :class="veennaUi.settingsRows">
        <div :class="['flex items-start justify-between gap-4', veennaUi.settingsRow]">
          <div class="min-w-0 flex-1 space-y-1.5">
            <div class="flex flex-wrap items-center gap-2">
              <AppTextLogo size-class="h-5 w-auto max-h-6" />
              <span class="text-caption text-veenna-muted">{{ APP_VERSION_LABEL }}</span>
            </div>
            <p class="text-caption text-veenna-muted">{{ APP_SLOGAN }}</p>
          </div>
          <AppPlatformBadge class="mt-0.5" />
        </div>
        <CommunityUpdateCheck />
      </div>
    </section>

    <CommunityMigrationSection v-if="isCommunity" />

    <section :class="[veennaUi.settingsCard, veennaUi.settingsRows]">
      <div :class="['flex items-start justify-between gap-4', veennaUi.settingsRow]">
        <div class="min-w-0 space-y-0.5">
          <p class="text-body font-medium text-veenna-foreground">Shortcuts</p>
          <p class="text-caption text-veenna-muted">
            Hold <span class="font-medium text-veenna-foreground">{{ hotkeyLabel }}</span> and speak.
            <span v-if="isElectron"> Current: {{ shortcutSummary }}.</span>
          </p>
          <p v-if="recordingHotkey" class="text-caption text-veenna-accent">
            Press a new shortcut. Esc cancels.
          </p>
        </div>
        <VeennaButton
          v-if="isElectron"
          variant="secondary"
          class="shrink-0"
          :loading="savingHotkey"
          @click="toggleHotkeyCapture"
        >
          {{ recordingHotkey || editingShortcut ? 'Cancel' : 'Change' }}
        </VeennaButton>
      </div>

      <div :class="['flex items-start justify-between gap-4', veennaUi.settingsRow]">
        <div class="min-w-0 flex-1 space-y-0.5">
          <p class="text-body font-medium text-veenna-foreground">Microphone</p>
          <p class="text-caption text-veenna-muted">{{ micLabel }}</p>
          <Select
            v-if="editingMic"
            :model-value="preferredMicId ?? 'default'"
            @update:model-value="(value) => onMicChange(String(value))"
          >
            <SelectTrigger class="mt-2 w-full max-w-xs">
              <SelectValue placeholder="Choose microphone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">System default microphone</SelectItem>
              <SelectItem
                v-for="device in micDevices"
                :key="device.deviceId"
                :value="device.deviceId"
              >
                {{ device.label || 'Microphone' }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <VeennaButton variant="secondary" class="shrink-0" @click="editingMic = !editingMic">
          {{ editingMic ? 'Cancel' : 'Change' }}
        </VeennaButton>
      </div>

      <div :class="['flex items-start justify-between gap-4', veennaUi.settingsRow]">
        <div class="min-w-0 flex-1 space-y-0.5">
          <p class="text-body font-medium text-veenna-foreground">Dictation languages</p>
          <p class="text-caption text-veenna-muted">{{ languageLabel }}</p>
          <Select
            v-if="editingLanguage"
            :model-value="selectedLanguage"
            @update:model-value="(value) => onLanguageChange(String(value))"
          >
            <SelectTrigger class="mt-2 w-full max-w-xs">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="option in languageOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <VeennaButton
          variant="secondary"
          class="shrink-0"
          @click="editingLanguage = !editingLanguage"
        >
          {{ editingLanguage ? 'Cancel' : 'Change' }}
        </VeennaButton>
      </div>

    </section>
  </div>
</template>
