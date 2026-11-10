<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { usePermissionRecheck } from '@/composables/usePermissionRecheck'
import { PhCheckCircle, PhWarningCircle } from '@phosphor-icons/vue'
import DictationHotkeySettings from '@/components/settings/DictationHotkeySettings.vue'
import HudAppearanceSettings from '@/components/settings/HudAppearanceSettings.vue'
import { VeennaButton } from '@/components/veenna'
import { Switch } from '@/components/ui/switch'
import { useElectron } from '@/composables/useElectron'
import { useSettings } from '@/composables/useSettings'
import { dictationKeyLabel, detectDictationPlatform } from '@/lib/dictation/dictationHotkey'
import { isElectron } from '@/lib/platform/isElectron'
import { isHudIdleVisibleSyncEvent } from '@/lib/voice/voiceHudIdleVisible'
import { isHudScreenShareVisibleSyncEvent } from '@/lib/voice/voiceHudScreenShareVisible'
import { veennaUi } from '@/lib/veennaUi'
import { useVoiceSettingsStore } from '@/stores/voiceSettings'
import { useErrorToast } from '@/composables/useMessageToast'
import SettingsRowTitle from '@/components/settings/SettingsRowTitle.vue'

const { api } = useElectron()
const voiceSettings = useVoiceSettingsStore()
const { openSettings } = useSettings()

const accessibility = ref<{
  required: boolean
  trusted: boolean
  hotkeyConsumesEvents?: boolean
  inputMonitoring?: boolean
  monitorBinary?: string | null
} | null>(null)
const hotkeyStatus = ref<{ ok: boolean; reason?: string } | null>(null)
const checking = ref(false)
const hudIdleSaving = ref(false)
const hudIdleError = ref<string | null>(null)
const hudScreenShareSaving = ref(false)
const hudScreenShareError = ref<string | null>(null)
const hotkeyLabel = computed(() => dictationKeyLabel())

const hudToggleEnabled = computed(() => !hudIdleSaving.value)
const hudScreenShareToggleEnabled = computed(() => !hudScreenShareSaving.value)

const accessibilityCopy = computed(() => {
  if (!accessibility.value?.required) {
    return 'Global dictation hotkeys are enabled.'
  }
  if (accessibility.value.trusted) {
    return `Hold ${hotkeyLabel.value} anywhere. Press ${hotkeyLabel.value} twice for hands-free. Open veenna under Agent in the sidebar for spoken conversation.`
  }
  if (accessibility.value.inputMonitoring === false) {
    return 'Enable Accessibility, then recheck. Input Monitoring is only needed if macOS cannot use Accessibility for the shortcut.'
  }
  return 'Enable Accessibility for veenna, then recheck.'
})

const showHotkeyPermissionHelp = computed(() => {
  if (detectDictationPlatform() !== 'mac') return false
  return !accessibility.value?.trusted || accessibility.value?.inputMonitoring === false
})

async function refreshStatus() {
  if (!api) return
  checking.value = true
  try {
    accessibility.value = (await api.getDictationAccessibility?.()) ?? null
  } finally {
    checking.value = false
  }
}

// Granting happens in System Settings; keep reading until it shows up here.
const recheck = usePermissionRecheck(
  // Quiet: only the status line moves, no spinner on every poll.
  async () => {
    accessibility.value = (await api?.getDictationAccessibility?.()) ?? accessibility.value
  },
  () => Boolean(accessibility.value?.trusted) && accessibility.value?.inputMonitoring !== false,
)

async function openInputMonitoringSettings() {
  await api?.openInputMonitoringSettings?.()
  recheck.watch()
}

async function openAccessibilitySettings() {
  await api?.openAccessibilitySettings?.()
  recheck.watch()
}

async function onHudIdleVisibleChange(visible: boolean) {
  if (!hudToggleEnabled.value) return
  hudIdleSaving.value = true
  hudIdleError.value = null
  try {
    await voiceSettings.setHudIdleVisible(visible)
  } catch {
    hudIdleError.value = 'Could not save HUD visibility. Try again.'
  } finally {
    hudIdleSaving.value = false
  }
}

async function onHudScreenShareVisibleChange(visible: boolean) {
  if (!hudScreenShareToggleEnabled.value) return
  hudScreenShareSaving.value = true
  hudScreenShareError.value = null
  try {
    await voiceSettings.setHudVisibleDuringScreenShare(visible)
  } catch {
    hudScreenShareError.value = 'Could not save screen share HUD setting. Try again.'
  } finally {
    hudScreenShareSaving.value = false
  }
}

function onHudStorage(event: StorageEvent) {
  if (isHudIdleVisibleSyncEvent(event)) {
    voiceSettings.syncHudIdleVisibleFromStorage()
  }
  if (isHudScreenShareVisibleSyncEvent(event)) {
    voiceSettings.syncHudVisibleDuringScreenShareFromStorage()
  }
}

onMounted(() => {
  voiceSettings.syncHudIdleVisibleFromStorage()
  voiceSettings.syncHudVisibleDuringScreenShareFromStorage()
  void voiceSettings.load()
  if (isElectron) void refreshStatus()
  window.addEventListener('storage', onHudStorage)
})

onUnmounted(() => {
  window.removeEventListener('storage', onHudStorage)
})

useErrorToast(hudIdleError)

useErrorToast(hudScreenShareError)
</script>

<template>
  <div class="space-y-3">
    <template v-if="isElectron">
      <section :class="veennaUi.settingsCard">
        <p :class="veennaUi.settingsGroupTitle">HUD visibility</p>
        <div :class="veennaUi.settingsRows">
          <div :class="veennaUi.settingsRow">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 space-y-0.5">
                <SettingsRowTitle
                  :hint="`Keep the HUD on screen when idle. Off, it appears only while you hold ${hotkeyLabel} to record.`"
                  >Show HUD when idle</SettingsRowTitle
                >
              </div>
              <Switch
                :model-value="voiceSettings.hudIdleVisible"
                :disabled="!hudToggleEnabled"
                aria-label="Show dictation HUD when idle"
                @update:model-value="onHudIdleVisibleChange"
              />
            </div>
          </div>
          <div :class="veennaUi.settingsRow">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 space-y-0.5">
                <SettingsRowTitle
                  hint="When off, the dictation HUD stays hidden from screenshots, shared screens, and recordings."
                  >Show HUD during screen sharing</SettingsRowTitle
                >
              </div>
              <Switch
                :model-value="voiceSettings.hudVisibleDuringScreenShare"
                :disabled="!hudScreenShareToggleEnabled"
                aria-label="Show dictation HUD during screen sharing"
                @update:model-value="onHudScreenShareVisibleChange"
              />
            </div>
          </div>
        </div>
      </section>

      <HudAppearanceSettings />

      <DictationHotkeySettings />

      <section :class="[veennaUi.settingsCard, veennaUi.settingsInset]">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 space-y-0.5">
            <p class="text-body font-medium text-veenna-foreground">Dictation hotkey</p>
            <p class="text-caption text-veenna-muted">{{ accessibilityCopy }}</p>
          </div>
          <component
            :is="
              accessibility?.trusted || !accessibility?.required ? PhCheckCircle : PhWarningCircle
            "
            class="h-5 w-5 shrink-0"
            :class="
              accessibility?.trusted || !accessibility?.required
                ? 'text-emerald-500'
                : 'text-amber-500'
            "
            weight="fill"
          />
        </div>

        <div
          v-if="hotkeyStatus && !hotkeyStatus.ok && hotkeyStatus.reason"
          class="mt-2 text-caption text-veenna-muted"
        >
          Listener: {{ hotkeyStatus.reason.replace(/_/g, ' ') }}
        </div>

        <div class="mt-2 flex flex-wrap gap-1.5">
          <VeennaButton
            v-if="accessibility?.required && !accessibility?.trusted"
            variant="primary"
            @click="openAccessibilitySettings"
          >
            Open Accessibility settings
          </VeennaButton>
          <VeennaButton variant="muted" :loading="checking" @click="refreshStatus">
            Recheck permissions
          </VeennaButton>
        </div>
      </section>

      <div
        v-if="showHotkeyPermissionHelp"
        class="rounded-md border border-amber-500/30 bg-amber-500/5 p-3"
      >
        <div class="space-y-0.5">
          <p class="text-body font-medium text-veenna-foreground">Global Option key</p>
          <p class="text-caption text-veenna-muted">
            Enable Accessibility and Input Monitoring for
            <span v-if="accessibility?.monitorBinary" class="font-mono">{{
              accessibility.monitorBinary
            }}</span>
            <span v-else>macos-dictation-key-monitor</span>, then recheck.
          </p>
        </div>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <VeennaButton
            v-if="!accessibility?.trusted"
            variant="primary"
            @click="openAccessibilitySettings"
          >
            Open Accessibility settings
          </VeennaButton>
          <VeennaButton
            v-if="accessibility?.inputMonitoring === false"
            variant="primary"
            @click="openInputMonitoringSettings"
          >
            Open Input Monitoring settings
          </VeennaButton>
        </div>
      </div>

      <p class="px-0.5 text-caption leading-relaxed text-veenna-muted">
        Hold {{ hotkeyLabel }} to dictate. Press {{ hotkeyLabel }} twice for hands-free. Drag the HUD
        to a screen edge to pin it.
      </p>
    </template>
  </div>
</template>
