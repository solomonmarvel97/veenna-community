<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useWallpaperDisplayUrl } from '@/composables/useWallpaperDisplayUrl'
import {
  WALLPAPER_BLUR_DEFAULT,
  clampWallpaperBlur,
  wallpaperFramingOf,
  wallpaperImageStyle,
} from '@/lib/veennaAppearance'
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()
const { appearance, wallpaperApplyGeneration } = storeToRefs(theme)
const { displayUrl, recoverFromLoadError } = useWallpaperDisplayUrl()
const settleFromApply = ref(false)

const wallpaperBlur = computed(() =>
  clampWallpaperBlur(appearance.value.wallpaperBlur ?? WALLPAPER_BLUR_DEFAULT),
)

/** The crop chosen in the wallpaper preview: focus point and zoom. */
const wallpaperStyle = computed(() => wallpaperImageStyle(wallpaperFramingOf(appearance.value)))

/** Remount the filtered layer when URL or blur changes so Electron repaints under open modals. */
const wallpaperLayerKey = computed(
  () => `${displayUrl.value ?? ''}|${wallpaperBlur.value}|${wallpaperApplyGeneration.value}`,
)

watch(wallpaperApplyGeneration, (generation) => {
  if (generation > 0) settleFromApply.value = true
})

async function onBackgroundError() {
  // Transient offline / CDN failures must not wipe the wallpaper cache or blank the UI.
  await recoverFromLoadError()
}
</script>

<template>
  <div
    v-if="theme.hasBackground"
    class="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-veenna-bg"
    data-app-wallpaper
    aria-hidden="true"
  >
    <div :key="wallpaperLayerKey" class="veenna-wallpaper-blur-layer absolute inset-0">
      <img
        v-if="displayUrl"
        :key="displayUrl"
        :src="displayUrl"
        alt=""
        class="veenna-wallpaper-cover absolute inset-0 h-full w-full"
        :class="settleFromApply ? 'wallpaper-bg-image' : undefined"
        :style="wallpaperStyle"
        loading="eager"
        decoding="async"
        fetchpriority="high"
        referrerpolicy="no-referrer"
        @error="onBackgroundError"
      />
    </div>
    <div
      class="absolute inset-0 electron-wallpaper-scrim"
      :style="{
        backgroundColor: `color-mix(in srgb, var(--veenna-bg) var(--veenna-wallpaper-scrim), transparent)`,
      }"
    />
  </div>
</template>
