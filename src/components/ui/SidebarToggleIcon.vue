<script setup lang="ts">
defineOptions({ name: 'SidebarToggleIcon' })

/**
 * The sidebar icon, filled, in two states that mirror each other: `open` fills
 * the sidebar side (the panel is showing), closed fills the content side (the
 * panel is folded away and the page has the room). Use it for every
 * sidebar/panel toggle. Size and colour come from the caller's classes.
 */
defineProps<{ open?: boolean }>()
</script>

<template>
  <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false">
    <!-- The window: always filled, softly. -->
    <rect x="32" y="40" width="192" height="176" rx="28" opacity="0.32" />
    <!-- Open: the sidebar (left) is solid. -->
    <path v-if="open" d="M60 40h52v176H60a28 28 0 0 1-28-28V68a28 28 0 0 1 28-28Z" />
    <!-- Closed: the content (right) is solid instead. -->
    <path v-else d="M124 40h72a28 28 0 0 1 28 28v120a28 28 0 0 1-28 28h-72Z" />
  </svg>
</template>
