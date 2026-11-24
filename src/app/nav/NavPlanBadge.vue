<script setup lang="ts">
import { computed, ref } from 'vue'
import AppLogo from '@/components/app/AppLogo.vue'
import NavSidebarToggle from '@/app/nav/NavSidebarToggle.vue'
import SidebarToggleIcon from '@/components/ui/SidebarToggleIcon.vue'
import NavHistoryArrows from '@/app/nav/NavHistoryArrows.vue'
import { isElectronMacMainWindow } from '@/lib/platform/isElectron'
import { useNavSidebarChrome } from '@/composables/useNavSidebarChrome'
import { prefersReducedMotion } from '@/motion/reducedMotion'

const {
  iconRail: navCollapsed,
  docked: navDocked,
  width: navWidth,
  setCollapsed,
} = useNavSidebarChrome()
/** A narrow sidebar shrinks the arrows rather than dropping them. */
const narrow = computed(() => navWidth.value < 220)
/** Mac app, signed out: the title strip already holds the logo and toggle, so below the lg breakpoint this row folds away (wide, it carries them). */
const inTitleStrip = computed(() => isElectronMacMainWindow && !navCollapsed.value)
const popping = ref(false)
const logoPulse = ref(0)
const expandShortcut =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘B' : 'Ctrl+B'

/** A little bounce and pulse on the logo. No confetti (the owner asked for it gone). */
function celebrateLogo() {
  logoPulse.value += 1
  if (prefersReducedMotion()) return
  popping.value = false
  requestAnimationFrame(() => {
    popping.value = true
  })
}

function expandSidebar() {
  setCollapsed(false)
}

function onLogoPopEnd() {
  popping.value = false
}
</script>

<template>
  <!-- On a phone the drawer header carries search and close, so this row is desktop only. -->
  <div v-if="navDocked" class="px-2 pb-1 pt-2" :class="inTitleStrip && 'max-lg:hidden'">
    <div
      class="flex w-full items-center gap-2 px-1 py-1.5"
      :class="navCollapsed && 'justify-center px-0'"
    >
      <template v-if="!navCollapsed">
        <button
          type="button"
          class="nav-plan-logo flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--veenna-focus-subtle)]"
          :class="{ 'nav-plan-logo--pop': popping }"
          aria-label="Celebrate"
          @click="celebrateLogo"
          @animationend="onLogoPopEnd"
        >
          <AppLogo size-class="h-7 w-7" alt="" animate :pulse="logoPulse" />
        </button>

        <div class="ml-auto flex shrink-0 items-center" :class="narrow ? 'gap-1' : 'gap-2'">
          <!-- The Mac app carries the arrows and the switch in the title strip. -->
          <NavHistoryArrows v-if="!isElectronMacMainWindow" />
          <NavSidebarToggle />
        </div>
      </template>
      <button
        v-else
        type="button"
        class="group no-drag flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-[6px] text-veenna-icon-muted transition-colors hover:text-veenna-fg focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--veenna-focus-subtle)]"
        :title="`Show sidebar (${expandShortcut})`"
        aria-label="Show sidebar"
        aria-expanded="false"
        @click="expandSidebar"
      >
        <!-- Hover or focus swaps the logo for the sidebar icon, so the click reads as "open". -->
        <AppLogo
          size-class="h-7 w-7"
          alt=""
          animate
          class="group-hover:hidden group-focus-visible:hidden"
        />
        <SidebarToggleIcon
          class="hidden h-4 w-4 group-hover:block group-focus-visible:block"
          :open="false"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.nav-plan-logo {
  cursor: pointer;
}

.nav-plan-logo--pop {
  animation: nav-plan-logo-pop 0.42s cubic-bezier(0.22, 1.4, 0.36, 1);
}

@keyframes nav-plan-logo-pop {
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
  .nav-plan-logo--pop {
    animation: none;
  }
}
</style>
