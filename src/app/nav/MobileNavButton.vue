<script setup lang="ts">
import { PhX } from '@phosphor-icons/vue'
import SidebarToggleIcon from '@/components/ui/SidebarToggleIcon.vue'
import { useNavSidebarChrome } from '@/composables/useNavSidebarChrome'
import { useResponsiveLayout } from '@/composables/useResponsiveLayout'

const { navOpen, toggleNav } = useResponsiveLayout()
const { docked } = useNavSidebarChrome()
</script>

<template>
  <button
    v-if="!docked"
    type="button"
    class="veenna-mobile-nav-btn inline-flex h-7 w-7 shrink-0 items-center justify-center text-veenna-fg transition-colors hover:text-veenna-icon active:scale-[0.98] focus-visible:outline-none lg:hidden"
    :aria-label="navOpen ? 'Close navigation' : 'Open navigation'"
    :aria-expanded="navOpen"
    @click="toggleNav()"
  >
    <PhX v-if="navOpen" class="h-4 w-4" weight="bold" />
    <SidebarToggleIcon v-else class="h-4 w-4" :open="false" />
  </button>
</template>

<style scoped>
.veenna-mobile-nav-btn {
  -webkit-tap-highlight-color: transparent;
}
</style>
