<script setup lang="ts">
import DictationControlCluster from '@/app/nav/DictationControlCluster.vue'
import { useNavSidebarChrome } from '@/composables/useNavSidebarChrome'

const { iconRail: navCollapsed, docked: navDocked } = useNavSidebarChrome()
</script>

<template>
  <div
    v-if="navDocked"
    class="shrink-0 border-t border-veenna-divider px-4 py-3"
    :class="navCollapsed && 'px-1 py-2'"
  >
    <div
      class="nav-dictation-controls"
      :class="navCollapsed && 'nav-dictation-controls--rail'"
      data-veenna-dictation-ui
    >
      <DictationControlCluster layout="sidebar" />
    </div>
  </div>
</template>
