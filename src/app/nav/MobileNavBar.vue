<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import MobileNavButton from '@/app/nav/MobileNavButton.vue'
import AppLogo from '@/components/app/AppLogo.vue'
import { prefersReducedMotion } from '@/motion/reducedMotion'
import { ROUTES } from '@/router/paths'

const router = useRouter()
const popping = ref(false)
const logoPulse = ref(0)

/** Same bounce as the sidebar logo (no confetti), then home. */
function onLogoClick() {
  logoPulse.value += 1
  if (!prefersReducedMotion()) {
    popping.value = false
    requestAnimationFrame(() => {
      popping.value = true
    })
  }
  if (router.currentRoute.value.path !== ROUTES.home) void router.push(ROUTES.home)
}
</script>

<template>
  <header
    class="veenna-mobile-nav-bar relative z-30 flex h-11 shrink-0 items-center justify-between border-b border-veenna-divider bg-black/[0.05] px-2 safe-top dark:bg-black/10 lg:hidden"
  >
    <MobileNavButton />
    <button
      type="button"
      class="mobile-nav-logo flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--veenna-focus-subtle)]"
      :class="{ 'mobile-nav-logo--pop': popping }"
      aria-label="Go home"
      @click="onLogoClick"
      @animationend="popping = false"
    >
      <AppLogo size-class="h-7 w-7" alt="" animate :pulse="logoPulse" />
    </button>
  </header>
</template>

<style scoped>
.mobile-nav-logo {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.mobile-nav-logo--pop {
  animation: mobile-nav-logo-pop 0.42s cubic-bezier(0.22, 1.4, 0.36, 1);
}

@keyframes mobile-nav-logo-pop {
  0% {
    transform: scale(1) rotate(0deg);
  }
  40% {
    transform: scale(1.22) rotate(-10deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mobile-nav-logo--pop {
    animation: none;
  }
}
</style>
