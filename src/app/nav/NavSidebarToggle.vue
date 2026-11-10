<script setup lang="ts">
import { computed } from 'vue'
import SidebarToggleIcon from '@/components/ui/SidebarToggleIcon.vue'
import { useNavSidebarChrome } from '@/composables/useNavSidebarChrome'

const nav = useNavSidebarChrome()
const expand = computed(() => nav.iconRail.value)
const label = computed(() => (expand.value ? 'Show sidebar' : 'Hide sidebar'))
const shortcut =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘B' : 'Ctrl+B'
</script>

<template>
  <button
    type="button"
    class="no-drag inline-flex h-7 w-7 shrink-0 items-center justify-center text-veenna-icon-muted transition-colors hover:text-veenna-fg focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--veenna-focus-subtle)]"
    :title="`${label} (${shortcut})`"
    :aria-label="label"
    :aria-expanded="!expand"
    @click="nav.toggleCollapsed()"
  >
    <SidebarToggleIcon class="h-4 w-4" :open="!expand" />
  </button>
</template>
