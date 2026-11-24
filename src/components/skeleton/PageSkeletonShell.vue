<script setup lang="ts">
/**
 * AppPageShell's frame for a page whose code is still loading: the same shell,
 * column, breadcrumb row and header, so the arriving page lands on top of it
 * without anything moving.
 *
 * The title is real text, not a bar. A page's name is known before its code
 * is, and reading "Notifications" tells you the click worked. Pass `subtitle`
 * as text when it is fixed, or `true` when the page computes it from data.
 *
 * Kept free of AppPageShell itself: placeholders ship in the startup bundle,
 * and the shell pulls in motion and search code that pages load later.
 */
import { computed } from 'vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { isElectron } from '@/lib/platform/isElectron'
import { veennaUi } from '@/lib/veennaUi'

const props = withDefaults(
  defineProps<{
    /** What is loading, for screen readers ("Loading notifications"). */
    label: string
    title?: string
    /**
     * Fixed subtitle text, or `true` for one the page fills in from data.
     * Boolean first: with `string | boolean` Vue reads a bare `subtitle` as ''.
     */
    subtitle?: boolean | string
    /** Mirrors AppPageShell `fill`: the page owns the full height below the header. */
    fill?: boolean
    frosted?: boolean
    /** Mirrors AppPageShell's breadcrumb row (web only, like the real one). */
    breadcrumb?: boolean
    /** Mirrors AppPageShell's top-right search button. */
    topSearch?: boolean
  }>(),
  {
    title: '',
    subtitle: false,
    fill: false,
    frosted: false,
    breadcrumb: false,
    topSearch: false,
  },
)

const showBreadcrumb = computed(() => props.breadcrumb && !isElectron)
const showTopChrome = computed(
  () => showBreadcrumb.value || props.topSearch || Boolean(props.title),
)
</script>

<template>
  <div
    :class="[
      fill
        ? [
            'veenna-pane veenna-scroll-hidden flex min-h-0 w-full flex-1 flex-col overflow-hidden',
            showTopChrome ? 'pt-[var(--veenna-main-top-padding)]' : '',
          ]
        : [veennaUi.pageShell, '!overflow-hidden'],
      frosted && 'veenna-frosted-shell',
    ]"
    role="status"
    aria-busy="true"
    :aria-label="label"
  >
    <div
      :class="
        fill
          ? 'mx-auto flex h-full min-h-0 w-full max-w-none flex-1 flex-col px-0'
          : [veennaUi.pageColumn, 'flex flex-col']
      "
    >
      <div v-if="showTopChrome" :class="['shrink-0 lg:pt-0', fill ? veennaUi.pageColumn : '']">
        <div v-if="showBreadcrumb || topSearch" class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div v-if="showBreadcrumb" class="mb-[42px] flex h-4 items-center sm:h-5">
              <Skeleton class="h-3 w-28" />
            </div>
          </div>
          <span v-if="topSearch" class="inline-flex h-8 w-8 shrink-0 items-center justify-center">
            <Skeleton rounded="full" class="h-4 w-4" :animated="false" />
          </span>
        </div>

        <header
          v-if="title"
          :class="[veennaUi.pageHeader, showBreadcrumb && veennaUi.pageHeaderAfterBreadcrumb]"
        >
          <div class="min-w-0 flex-1">
            <h1 :class="veennaUi.pageTitle">{{ title }}</h1>
            <p v-if="typeof subtitle === 'string' && subtitle" :class="veennaUi.pageSubtitle">
              {{ subtitle }}
            </p>
            <!-- Same line box as the real subtitle, so the body below starts where it will. -->
            <div v-else-if="subtitle === true" :class="[veennaUi.pageSubtitle, 'flex items-center']">
              <span class="invisible w-0">&#8203;</span>
              <Skeleton class="h-3 w-48 max-w-[70%] sm:h-3.5" :delay="40" />
            </div>
          </div>
          <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
            <slot name="actions" />
          </div>
        </header>
      </div>

      <div :class="fill ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : veennaUi.pageBody">
        <slot />
      </div>
    </div>
  </div>
</template>
