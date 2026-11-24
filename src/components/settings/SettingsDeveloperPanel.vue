<script setup lang="ts">
import { Switch } from '@/components/ui/switch'
import { developerModeEnabled, setDeveloperMode } from '@/lib/trace'
import { veennaUi } from '@/lib/veennaUi'
import SettingsRowTitle from '@/components/settings/SettingsRowTitle.vue'
</script>

<template>
  <div class="w-full space-y-4">
    <section :class="veennaUi.settingsCard">
      <p :class="veennaUi.settingsGroupTitle">Developer mode</p>
      <div :class="veennaUi.settingsRows">
        <div :class="veennaUi.settingsRow">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 space-y-0.5">
              <SettingsRowTitle
                hint="Records every step of each dictation, from the key release to the paste. Open one from its menu in your dictation history with View trace. Traces stay on this computer; the last 40 are kept."
                >Trace every dictation</SettingsRowTitle
              >
            </div>
            <Switch
              :model-value="developerModeEnabled"
              aria-label="Trace every dictation"
              @update:model-value="setDeveloperMode(Boolean($event))"
            />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
