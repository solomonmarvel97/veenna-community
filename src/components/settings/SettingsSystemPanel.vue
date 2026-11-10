<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { useElectron } from '@/composables/useElectron'
import { Switch } from '@/components/ui/switch'
import { isElectron } from '@/lib/platform/isElectron'
import { areDictationHudSoundsEnabled, playDictationHudSound, writeDictationHudSoundsEnabled } from '@/lib/voice/dictationHudSounds'
import { isDuckAudioWhileDictatingEnabled, writePrivacySettings } from '@/lib/privacySettings'
import { veennaUi } from '@/lib/veennaUi'
import type { OpenAtLoginStatus } from '@/types/electron'
import { useErrorToast } from '@/composables/useMessageToast'
import { getLegalPages } from '@/lib/publicWebUrls'
import { openSystemBrowser } from '@/lib/platform/openSystemBrowser'
import OpenSourceLicensesModal from './OpenSourceLicensesModal.vue'
import SettingsRowTitle from '@/components/settings/SettingsRowTitle.vue'

const { api } = useElectron()
const router = useRouter()
const loginStatus = ref<OpenAtLoginStatus | null>(null)
const openAtLogin = ref(false)
const loginReady = ref(false)
const loginSaving = ref(false)
const loginError = ref<string | null>(null)
const hudSoundsEnabled = ref(areDictationHudSoundsEnabled())
const duckAudioEnabled = ref(isDuckAudioWhileDictatingEnabled())
const duckAudioSaving = ref(false)
const licensesOpen = ref(false)
const legalPages = getLegalPages()
const legalError = ref('')

async function openLegalPage(url: string) {
  legalError.value = ''
  try {
    await openSystemBrowser(url)
  } catch (error) {
    legalError.value = error instanceof Error ? error.message : 'Could not open your browser.'
  }
}

useErrorToast(legalError, { title: 'Could not open legal page' })

const loginHelp = computed(() => {
  if (loginStatus.value?.canRegister === false) {
    return 'Available in the installed app only.'
  }
  if (openAtLogin.value) {
    return 'Starts at login with menu bar and HUD. Main window stays hidden.'
  }
  return 'Launch veenna when you sign in.'
})

async function refreshLoginStatus() {
  if (!api) {
    loginReady.value = true
    return
  }
  try {
    loginStatus.value = (await api.getOpenAtLogin?.()) ?? null
    openAtLogin.value = Boolean(loginStatus.value?.openAtLogin)
  } finally {
    loginReady.value = true
  }
}

async function onOpenAtLoginChange(enabled: boolean) {
  if (!api?.setOpenAtLogin || loginSaving.value) return
  const previous = openAtLogin.value
  openAtLogin.value = enabled
  loginSaving.value = true
  loginError.value = null
  try {
    const result = await api.setOpenAtLogin(enabled)
    if (!result.ok) {
      loginError.value =
        result.reason === 'dev_mode'
          ? 'Run at login is only available in the installed desktop app.'
          : 'Could not update login item. Try again from the packaged app.'
      openAtLogin.value = previous
      return
    }
    // Prefer the persisted preference so the switch stays put (system APIs can lag).
    openAtLogin.value = Boolean(result.requested ?? result.openAtLogin ?? enabled)
    loginStatus.value = {
      ...(loginStatus.value || {
        systemOpenAtLogin: false,
        wasOpenedAtLogin: false,
        canRegister: true,
      }),
      openAtLogin: openAtLogin.value,
    }
  } catch {
    loginError.value = 'Could not update login item. Try again.'
    openAtLogin.value = previous
  } finally {
    loginSaving.value = false
  }
}

function onHudSoundsChange(enabled: boolean) {
  hudSoundsEnabled.value = enabled
  writeDictationHudSoundsEnabled(enabled)
  if (enabled) playDictationHudSound('success')
}

async function onDuckAudioChange(enabled: boolean) {
  duckAudioSaving.value = true
  duckAudioEnabled.value = enabled
  writePrivacySettings({ duckAudioWhileDictating: enabled })
  try {
    await api?.setDuckAudioWhileDictating?.(enabled)
  } finally {
    duckAudioSaving.value = false
  }
}

onMounted(async () => {
  if (isElectron) {
    void refreshLoginStatus()
    // Persist the opt-in default (off) and align Electron so older installs cannot stay muted.
    const next = writePrivacySettings({})
    duckAudioEnabled.value = next.duckAudioWhileDictating
    try {
      await api?.setDuckAudioWhileDictating?.(next.duckAudioWhileDictating)
    } catch {
      /* main process may not be ready */
    }
  }
})

useErrorToast(loginError)
</script>

<template>
  <div class="w-full space-y-4">

    <section v-if="isElectron" :class="veennaUi.settingsCard">
      <p :class="veennaUi.settingsGroupTitle">App settings</p>
      <div :class="veennaUi.settingsRows">
        <div :class="veennaUi.settingsRow">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 space-y-0.5">
              <SettingsRowTitle :hint="loginHelp">Launch app at login</SettingsRowTitle>
            </div>
            <Switch
              v-if="loginReady"
              :model-value="openAtLogin"
              :disabled="loginSaving"
              aria-label="Run veenna at login"
              @update:model-value="onOpenAtLoginChange"
            />
            <div
              v-else
              class="h-6 w-11 shrink-0 rounded-full bg-veenna-border/60"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </section>

    <section :class="veennaUi.settingsCard">
      <p :class="veennaUi.settingsGroupTitle">Sound</p>
      <div :class="veennaUi.settingsRows">
        <div :class="veennaUi.settingsRow">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 space-y-0.5">
              <SettingsRowTitle
                hint="Short tones when recording starts, processing, succeeds, or fails."
                >Dictation and notification sounds</SettingsRowTitle
              >
            </div>
            <Switch
              :model-value="hudSoundsEnabled"
              aria-label="Dictation HUD sounds"
              @update:model-value="onHudSoundsChange"
            />
          </div>
        </div>

        <div v-if="isElectron" :class="veennaUi.settingsRow">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 space-y-0.5">
              <SettingsRowTitle
                hint="Lower other system audio while you hold the dictation hotkey. Restores volume when you finish."
                >Mute music while dictating</SettingsRowTitle
              >
            </div>
            <Switch
              :model-value="duckAudioEnabled"
              :disabled="duckAudioSaving"
              aria-label="Mute music while dictating"
              @update:model-value="onDuckAudioChange"
            />
          </div>
        </div>
      </div>
    </section>

    <section :class="veennaUi.settingsCard">
      <p :class="veennaUi.settingsGroupTitle">About</p>
      <div :class="veennaUi.settingsRows">
        <div v-for="page in legalPages" :key="page.url" :class="veennaUi.settingsRow">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 space-y-0.5">
              <SettingsRowTitle :hint="page.description">{{ page.label }}</SettingsRowTitle>
            </div>
            <Button variant="outline" size="sm" @click="openLegalPage(page.url)">Open</Button>
          </div>
        </div>
        <div :class="veennaUi.settingsRow">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 space-y-0.5">
              <SettingsRowTitle
                hint="Notices for the open-source software inside Veenna Community, including the speech engine."
                >Open-source licenses</SettingsRowTitle
              >
            </div>
            <Button variant="outline" size="sm" @click="licensesOpen = true">View</Button>
          </div>
        </div>
      </div>
    </section>


    <OpenSourceLicensesModal :open="licensesOpen" @close="licensesOpen = false" />
  </div>
</template>
