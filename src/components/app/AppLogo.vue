<script setup lang="ts">
import { APP_LOGO_ALT } from '@/config/appLogo'
import VeennaMark from '@/components/app/VeennaMark.vue'

withDefaults(
  defineProps<{
    /** Tailwind size classes, e.g. `h-8 w-8` */
    sizeClass?: string
    alt?: string
    /** Draw the app-icon plate (white squircle + hairline), as the favicon
     * and the packaged app do. Off, the default in the app: bare mark in
     * `currentColor`. */
    plate?: boolean
    /** Pulse outward from the centre, once every few seconds. */
    animate?: boolean
    /** Bump to send a pulse right now (on click); the interval pulse carries on. */
    pulse?: number
  }>(),
  {
    sizeClass: 'h-8 w-8',
    alt: APP_LOGO_ALT,
    plate: false,
    animate: false,
    pulse: 0,
  },
)
</script>

<template>
  <svg
    viewBox="0 0 192.1 192.1"
    xmlns="http://www.w3.org/2000/svg"
    :class="sizeClass"
    :role="alt ? 'img' : undefined"
    :aria-hidden="alt ? undefined : 'true'"
  >
    <title v-if="alt">{{ alt }}</title>
    <VeennaMark :plate="plate" :animate="animate" :pulse="pulse" />
  </svg>
</template>
