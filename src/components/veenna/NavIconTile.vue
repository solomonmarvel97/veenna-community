<script setup lang="ts">
import type { Component } from 'vue'
import { NAV_ICON_TILE_COLORS, type NavIconTileColor } from '@/lib/navIconTile'
import { cn } from '@/lib/utils'

withDefaults(
  defineProps<{
    icon: Component
    color: NavIconTileColor
    size?: 'sm' | 'lg'
    /**
     * `glyph`: the icon alone, drawn in the tile's colour with no square
     * behind it. For rows nested under a main menu item (the apps under
     * Apps), so they read as children rather than as more top-level menus.
     * `soft`: a very light wash of the tile's colour behind a filled icon in
     * that same colour.
     */
    variant?: 'tile' | 'glyph' | 'soft'
    /** Stroke of the icon. Filled unless a row asks for an outline. */
    weight?: 'fill' | 'regular' | 'light' | 'bold'
  }>(),
  { size: 'sm', variant: 'tile', weight: 'fill' },
)
</script>

<template>
  <span
    v-if="variant === 'glyph'"
    :class="
      cn(
        'inline-flex shrink-0 items-center justify-center',
        size === 'lg' ? 'h-14 w-14 p-2 sm:h-16 sm:w-16' : 'size-5 p-px',
      )
    "
    :style="{ color: NAV_ICON_TILE_COLORS[color] }"
    aria-hidden="true"
  >
    <component :is="icon" class="size-full" :weight="weight" />
  </span>
  <span
    v-else-if="variant === 'soft'"
    :class="
      cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden',
        size === 'lg'
          ? 'h-14 w-14 rounded-[12px] p-3 sm:h-16 sm:w-16 sm:rounded-[14px] sm:p-3.5'
          : 'size-5 rounded-[5px] p-[3px]',
      )
    "
    :style="{
      color: NAV_ICON_TILE_COLORS[color],
      backgroundColor: `color-mix(in srgb, ${NAV_ICON_TILE_COLORS[color]} 16%, transparent)`,
    }"
    aria-hidden="true"
  >
    <component :is="icon" class="size-full" :weight="weight" />
  </span>
  <span
    v-else
    :class="
      cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden text-white shadow-[inset_0_0.5px_0_rgba(255,255,255,0.28)] [&_svg]:text-white',
        size === 'lg'
          ? 'h-14 w-14 rounded-[12px] p-3 sm:h-16 sm:w-16 sm:rounded-[14px] sm:p-3.5'
          : 'size-5 rounded-[5px] p-[3px]',
      )
    "
    :style="{ backgroundColor: NAV_ICON_TILE_COLORS[color] }"
    aria-hidden="true"
  >
    <component :is="icon" class="size-full" :weight="weight" />
  </span>
</template>
