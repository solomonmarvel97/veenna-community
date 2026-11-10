<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from 'reka-ui'
import { PhArrowCounterClockwise, PhMicrophone, PhSpinner } from '@phosphor-icons/vue'
import { VeennaButton } from '@/components/veenna'
import {
  DEFAULT_HUD_APPEARANCE,
  HUD_SURFACE_OPTIONS,
  isHudAppearanceSyncEvent,
  type HudAppearanceConfig,
  type HudSurfaceStyle,
} from '@/lib/voice/voiceHudAppearance'
import { veennaUi } from '@/lib/veennaUi'
import { useVoiceSettingsStore } from '@/stores/voiceSettings'
import SettingsRowTitle from '@/components/settings/SettingsRowTitle.vue'

const voiceSettings = useVoiceSettingsStore()

function patchAppearance(partial: Partial<HudAppearanceConfig>) {
  void voiceSettings.setHudAppearance({ ...voiceSettings.hudAppearance, ...partial })
}

function selectSurface(id: HudSurfaceStyle) {
  patchAppearance({ surface: id })
}

function resetAppearance() {
  void voiceSettings.setHudAppearance({ ...DEFAULT_HUD_APPEARANCE })
}

function onStorageSync(event: StorageEvent) {
  if (isHudAppearanceSyncEvent(event)) {
    voiceSettings.syncHudAppearanceFromStorage()
  }
}

onMounted(() => {
  window.addEventListener('storage', onStorageSync)
})

onUnmounted(() => {
  window.removeEventListener('storage', onStorageSync)
})
</script>

<template>
  <section :class="veennaUi.settingsCard">
    <TooltipProvider :delay-duration="150">
      <div :class="veennaUi.settingsRows">
        <div :class="veennaUi.settingsRow">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 space-y-0.5">
              <SettingsRowTitle hint="Pick the surface of the floating dictation pill."
                >HUD appearance</SettingsRowTitle
              >
            </div>
            <VeennaButton variant="ghost" class="shrink-0 text-caption" @click="resetAppearance">
              <PhArrowCounterClockwise class="h-3.5 w-3.5 shrink-0" weight="bold" />
              Reset
            </VeennaButton>
          </div>
        </div>

        <div
          :class="[
            veennaUi.settingsRow,
            'relative overflow-hidden pb-3 pt-3',
            `hud-surface-preview hud-surface-preview--${voiceSettings.hudAppearance.surface}`,
          ]"
        >
          <div
            class="pointer-events-none absolute inset-0 opacity-40"
            style="
              background:
                radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.12), transparent 45%),
                radial-gradient(circle at 80% 70%, rgba(120, 160, 255, 0.12), transparent 40%);
            "
          />
          <div class="relative flex items-center justify-center gap-3 py-1">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hud-preview-pill"
              :class="`hud-preview-pill--${voiceSettings.hudAppearance.surface}`"
            >
              <PhMicrophone class="h-3.5 w-3.5 text-white" weight="bold" aria-hidden="true" />
            </div>
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hud-preview-pill"
              :class="`hud-preview-pill--${voiceSettings.hudAppearance.surface}`"
            >
              <PhSpinner
                class="h-3.5 w-3.5 animate-spin text-white"
                weight="bold"
                aria-hidden="true"
              />
            </div>
          </div>
          <p class="relative mt-2 text-center text-caption text-white/55">
            Idle · Processing preview
          </p>
        </div>

        <div :class="veennaUi.settingsRow">
          <div class="space-y-1.5">
            <p class="text-label font-medium uppercase tracking-overline text-veenna-muted">
              Surface
            </p>
            <div class="flex flex-wrap gap-4">
              <TooltipRoot v-for="option in HUD_SURFACE_OPTIONS" :key="option.id">
                <TooltipTrigger as-child>
                  <button
                    type="button"
                    class="hud-surface-chip"
                    :class="{
                      'hud-surface-chip--active': voiceSettings.hudAppearance.surface === option.id,
                      [`hud-surface-chip--${option.id}`]: true,
                    }"
                    @click="selectSurface(option.id)"
                  >
                    <span class="text-caption font-medium">{{ option.label }}</span>
                  </button>
                </TooltipTrigger>
                <TooltipPortal>
                  <TooltipContent
                    side="top"
                    :side-offset="6"
                    class="z-[400] max-w-[16rem] rounded-md border border-veenna-divider bg-veenna-surface px-2.5 py-1.5 text-caption leading-snug text-veenna-fg shadow-veenna-sm"
                  >
                    {{ option.description }}
                  </TooltipContent>
                </TooltipPortal>
              </TooltipRoot>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  </section>
</template>

<style scoped>
/* Plain text buttons: the chosen surface reads in full-strength text, the rest muted. */
.hud-surface-chip {
  border: 0;
  background: transparent;
  padding: 0.25rem 0;
  color: var(--veenna-muted);
  cursor: pointer;
  transition: color 120ms ease;
}

.hud-surface-chip:hover,
.hud-surface-chip--active {
  color: var(--veenna-fg);
}

.hud-surface-chip--active {
  text-decoration: underline;
  text-underline-offset: 4px;
}

.hud-surface-preview {
  position: relative;
  overflow: hidden;
  background: #101010;
}

.hud-surface-preview--glass {
  background: linear-gradient(145deg, rgba(30, 30, 30, 0.85), rgba(10, 10, 10, 0.75));
}

.hud-surface-preview--frost {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.16), rgba(180, 190, 210, 0.08));
}

.hud-preview-pill {
  background: rgba(14, 14, 14, 0.92);
}

.hud-preview-pill--glass {
  background: rgba(22, 22, 22, 0.88);
  backdrop-filter: none;
}

.hud-preview-pill--frost {
  background: rgba(28, 28, 28, 0.9);
  backdrop-filter: none;
  color: rgba(255, 255, 255, 0.95);
}
</style>
