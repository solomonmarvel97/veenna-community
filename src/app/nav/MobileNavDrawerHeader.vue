<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { PhX } from '@phosphor-icons/vue'
import AppTextLogo from '@/components/app/AppTextLogo.vue'
import { useResponsiveLayout } from '@/composables/useResponsiveLayout'

const { navOpen, closeNav } = useResponsiveLayout()
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && navOpen.value) {
    closeNav()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <header
    class="flex h-12 shrink-0 items-center justify-between border-b border-veenna-divider veenna-divide px-3 lg:hidden"
  >
    <div class="flex items-center gap-3">
      <AppTextLogo size-class="h-[18px] w-auto max-h-[18px]" />
    </div>
    <div class="flex items-center">
      <button
        type="button"
        class="flex h-8 w-8 items-center justify-center text-veenna-fg transition-opacity hover:opacity-70 focus-visible:outline-none"
        aria-label="Close navigation"
        @click="closeNav()"
      >
        <PhX class="h-4 w-4" weight="bold" />
      </button>
    </div>
  </header>
</template>
