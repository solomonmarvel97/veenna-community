<script setup lang="ts">
import AppPageShell from '@/components/app/AppPageShell.vue'
import CommunityEditionNote from '@/components/app/CommunityEditionNote.vue'
import VoiceActivityFeed from '@/components/voice/VoiceActivityFeed.vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { QUERY } from '@/router/paths'
import { queryString } from '@/router/query'
import { veennaUi } from '@/lib/veennaUi'

defineOptions({ name: 'DictationView' })

/** `?capture=` opens that dictation in the history. */
const route = useRoute()
const focusCaptureId = computed(() => queryString(route.query[QUERY.capture]))
</script>

<template>
  <AppPageShell
    title="Dictation"
    subtitle="Speak naturally and browse your capture history here."
    hide-top-search
    reveal
    frosted
  >
    <div :class="['space-y-6', veennaUi.pageHeroGap]" data-section-reveal>
      <CommunityEditionNote />
      <VoiceActivityFeed mode="full" :focus-capture-id="focusCaptureId" />
    </div>
  </AppPageShell>
</template>
