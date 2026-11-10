<script setup lang="ts">
import { APP_LOGO_ALT } from '@/config/appLogo'

/**
 * The veenna wordmark: live text in Geist, not an image, so it takes the
 * current colour in either theme and stays sharp at any size.
 *
 * The viewBox is the ink box of the word at `font-size: 1000` — 22.1 is the
 * left sidebearing of the `v`, the baseline sits at y=0, and the box runs from
 * the cap of the `n` (-542) to the overshoot under the `e` (+12). Sizing the
 * svg by height therefore sizes the letters exactly, which is how every caller
 * uses it.
 *
 * `textLength` pins the total advance to the logotype's tracking (noticeably
 * tighter than Geist sets by default) and, as a bonus, keeps the word inside
 * the box in the moment before the webfont lands.
 */

withDefaults(
  defineProps<{
    /** Tailwind size classes, e.g. `h-6 w-auto max-h-7` */
    sizeClass?: string
    alt?: string
  }>(),
  {
    sizeClass: 'h-6 w-auto max-h-7',
    alt: APP_LOGO_ALT,
  },
)
</script>

<template>
  <svg
    viewBox="22.1 -542 3115 554"
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    :class="[sizeClass, 'w-auto max-w-full']"
    :role="alt ? 'img' : undefined"
    :aria-hidden="alt ? undefined : 'true'"
  >
    <title v-if="alt">{{ alt }}</title>
    <!-- prettier-ignore -->
    <text
      x="0"
      y="0"
      font-size="1000"
      font-weight="380"
      textLength="3181.3"
      lengthAdjust="spacing"
      style="font-family: var(--veenna-font)"
    >veenna.</text>
  </svg>
</template>
