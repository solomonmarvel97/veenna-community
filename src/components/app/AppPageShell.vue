<script setup lang="ts">
import { computed, ref, toRef, useSlots } from 'vue'
import PageContentColumn from '@/components/app/PageContentColumn.vue'
import { useMotionReveal } from '@/composables/useMotionReveal'
import { revealPublic } from '@/motion'
import { veennaUi } from '@/lib/veennaUi'

const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    wide?: boolean
    narrow?: boolean
    /** Hide auto breadcrumbs (rare). */
    hideBreadcrumb?: boolean
    /** Hide the top-right search button (e.g. dedicated search page). */
    hideTopSearch?: boolean
    /** No pane surface - for full-bleed shells (e.g. Tasks). */
    transparent?: boolean
    /** Fill main chrome width and height (e.g. Notes). */
    fill?: boolean
    /** Home: solid veenna-bg shell to match greeting hero gradient. */
    homePage?: boolean
    /** Frosted wallpaper blur, matching Agent / Knowledge. */
    frosted?: boolean
    /** Staggered enter for `[data-section-reveal]` descendants. */
    reveal?: boolean
    /** Extra-wide column for content-heavy pages (e.g. Files grid) */
    full?: boolean
  }>(),
  {
    wide: false,
    narrow: false,
    hideBreadcrumb: false,
    hideTopSearch: false,
    transparent: false,
    fill: false,
    homePage: false,
    frosted: false,
    reveal: false,
    full: false,
  },
)

const shellRootRef = ref<HTMLElement | null>(null)
const slots = useSlots()

const showTopChrome = computed(
  () =>
    !props.homePage &&
    (props.title || Boolean(slots.header) || Boolean(slots.headerTrailing)),
)

useMotionReveal(shellRootRef, {
  replayOnActivate: true,
  childSelector: '[data-section-reveal]',
  enabled: toRef(props, 'reveal'),
  // Opacity-only: translateY on flex scroll shells breaks height/overflow between routes.
  duration: revealPublic.duration,
  stagger: revealPublic.stagger,
  ease: revealPublic.ease,
  y: 0,
})
</script>

<template>
  <div
    ref="shellRootRef"
    :class="[
      fill
        ? [
            'veenna-pane veenna-scroll-hidden flex min-h-0 w-full flex-1 flex-col overflow-x-hidden overflow-hidden',
            showTopChrome ? 'pt-[var(--veenna-main-top-padding)]' : '',
          ]
        : homePage
          ? // No veenna-pane: that class forces solid --veenna-bg and blocks the wallpaper hero.
            'home-page-shell veenna-page-scroll veenna-scroll-hidden flex min-h-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto !pt-0'
          : transparent
            ? 'veenna-scroll-hidden min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto'
            : veennaUi.pageShell,
      frosted && 'veenna-frosted-shell',
    ]"
  >
    <!-- Stays pinned while the home page scrolls; height 0 so it overlays the hero. -->
    <div
      v-if="homePage && $slots.stickyChrome"
      class="pointer-events-none sticky top-0 z-[40] h-0 w-full shrink-0 overflow-visible"
    >
      <div class="flex justify-center">
        <slot name="stickyChrome" />
      </div>
    </div>

    <!-- Home hero: full-bleed to main pane edges (above the padded content column) -->
    <header v-if="homePage && $slots.header" class="w-full shrink-0" data-section-reveal>
      <slot name="header" />
    </header>

    <div :class="homePage ? 'home-page-below-hero flex w-full flex-1 flex-col' : 'contents'">
      <PageContentColumn
        :wide="wide"
        :narrow="narrow"
        :home="homePage"
        :fill="fill"
        :full="full"
        :class="
          fill
            ? 'flex min-h-0 flex-1 flex-col'
            : homePage
              ? 'flex w-full shrink-0 grow flex-col'
              : 'flex w-full flex-col'
        "
      >
        <div
          v-if="showTopChrome"
          :class="[
            'shrink-0 lg:pt-0',
            fill ? (full ? 'mx-auto w-full max-w-[1600px] px-4' : veennaUi.pageColumn) : '',
          ]"
        >
          <header
            v-if="$slots.header"
            :class="[veennaUi.pageHeader, 'justify-start !pt-0']"
            data-section-reveal
          >
            <div class="w-full">
              <slot name="header" />
            </div>
          </header>

          <header
            v-else-if="title"
            :class="veennaUi.pageHeader"
            data-section-reveal
          >
            <div class="min-w-0 flex-1">
              <h1 :class="veennaUi.pageTitle">{{ title }}</h1>
              <p v-if="subtitle" :class="veennaUi.pageSubtitle">{{ subtitle }}</p>
            </div>
            <div v-if="$slots.headerTrailing" class="shrink-0">
              <slot name="headerTrailing" />
            </div>
          </header>
        </div>

        <div
          :class="[
            fill ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : veennaUi.pageBody,
            homePage && 'min-h-fit shrink-0 grow pt-2 sm:pt-3 pb-8 sm:pb-12',
          ]"
        >
          <slot />
        </div>
      </PageContentColumn>
    </div>
  </div>
</template>
