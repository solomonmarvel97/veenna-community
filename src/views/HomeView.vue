<script setup lang="ts">
import AppPageShell from '@/components/app/AppPageShell.vue'
import CommunityEditionNote from '@/components/app/CommunityEditionNote.vue'
import VoiceActivityFeed from '@/components/voice/VoiceActivityFeed.vue'

defineOptions({ name: 'HomeView' })
</script>

<template>
  <AppPageShell hide-breadcrumb home-page reveal>
    <div class="flex flex-1 flex-col space-y-4 sm:space-y-5">
      <!-- Name the app on its own landing page. -->
      <CommunityEditionNote data-section-reveal />
      <!-- The page is this note and the feed, so an empty feed centres in the pane. -->
      <VoiceActivityFeed data-section-reveal mode="preview" center-empty />
    </div>
  </AppPageShell>
</template>
