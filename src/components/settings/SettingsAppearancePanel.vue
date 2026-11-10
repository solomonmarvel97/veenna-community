<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { PhArrowsOut, PhImage, PhTrash, PhSun, PhMoon, PhDesktop } from '@phosphor-icons/vue'
import { Input } from '@/components/ui/input'
import { ACCENT_COLOR_PRESETS, DEFAULT_ACCENT, WALLPAPER_BLUR_DEFAULT, WALLPAPER_BLUR_MAX, WALLPAPER_BLUR_MIN, accentForTheme, clampWallpaperBlur, normalizeHex } from '@/lib/veennaAppearance'
import { useThemeStore, type ThemeMode } from '@/stores/theme'
import { ModalBody, ModalHeader, SegmentControl, VeennaButton, VeennaModal } from '@/components/veenna'
import { Switch } from '@/components/ui/switch'
import { storeToRefs } from 'pinia'
import { veennaUi } from '@/lib/veennaUi'
import SettingsRowTitle from '@/components/settings/SettingsRowTitle.vue'

const router = useRouter()
const theme = useThemeStore()
const {
  mode,
  appearance,
  backgroundUrl,
  hasBackground,
  hasCustomAccent,
  hasCustomTheme,
  resolved,
  motionEnabled,
} = storeToRefs(theme)

const wallpaperPreviewOpen = ref(false)

const wallpaperBlur = computed({
  get: () => clampWallpaperBlur(appearance.value.wallpaperBlur ?? WALLPAPER_BLUR_DEFAULT),
  set: (value: number) => theme.setWallpaperBlur(value),
})

const accentLightInput = ref('')
const accentDarkInput = ref('')

const previewAccent = computed(() => accentForTheme(appearance.value, resolved.value))

const themeOptions = [
  { id: 'system', label: 'System', icon: PhDesktop },
  { id: 'light', label: 'Light', icon: PhSun },
  { id: 'dark', label: 'Dark', icon: PhMoon },
] as const

const themeMode = computed({
  get: () => mode.value,
  set: (value: string) => theme.setMode(value as ThemeMode),
})

let unwatch: (() => void) | undefined

onMounted(() => {
  unwatch = theme.watchSystemPreference()
  accentLightInput.value = appearance.value.accentLight ?? ''
  accentDarkInput.value = appearance.value.accentDark ?? ''
})

onUnmounted(() => {
  unwatch?.()
})

function syncInputs() {
  accentLightInput.value = appearance.value.accentLight ?? ''
  accentDarkInput.value = appearance.value.accentDark ?? ''
}

function openWallpaperPreview() {
  if (!hasBackground.value || !backgroundUrl.value) return
  wallpaperPreviewOpen.value = true
}

function clearBackground() {
  wallpaperPreviewOpen.value = false
  theme.clearBackground()
}

function pickLight(color: string | null) {
  theme.setAccentLight(color)
  accentLightInput.value = color ?? ''
}

function pickDark(color: string | null) {
  theme.setAccentDark(color)
  accentDarkInput.value = color ?? ''
}

function onLightInput() {
  const hex = normalizeHex(accentLightInput.value)
  if (hex) theme.setAccentLight(hex)
  else if (!accentLightInput.value.trim()) theme.setAccentLight(null)
}

function onDarkInput() {
  const hex = normalizeHex(accentDarkInput.value)
  if (hex) theme.setAccentDark(hex)
  else if (!accentDarkInput.value.trim()) theme.setAccentDark(null)
}

function resetAccents() {
  theme.resetAccents()
  syncInputs()
}

function resetTheme() {
  theme.resetTheme()
  syncInputs()
}

const wallpaperThumbStyle = computed(() => {
  // The thumbnail is far smaller than the window, so scale the blur down to match.
  const blur = wallpaperBlur.value / 4
  return {
    backgroundImage: `url(${backgroundUrl.value})`,
    filter: blur > 0 ? `blur(${blur}px)` : undefined,
    transform: blur > 0 ? 'scale(1.08)' : undefined,
  }
})

</script>

<template>
  <div class="space-y-3">
    <section :class="[veennaUi.settingsCard, veennaUi.settingsInset]">
      <p class="text-body font-medium text-veenna-foreground">Theme</p>
      <p class="mt-0.5 text-caption text-veenna-muted">Light, dark, or follow your system.</p>
      <SegmentControl
        v-model="themeMode"
        :options="[...themeOptions]"
        variant="pill"
        class="mt-2"
        aria-label="Theme mode"
      />
    </section>

    <section :class="[veennaUi.settingsCard, veennaUi.settingsInset]">
      <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)] sm:items-start">
        <div class="order-2 min-w-0 sm:order-1">
          <p class="text-body font-medium text-veenna-foreground">Wallpaper</p>
          <p class="mt-0.5 text-caption text-veenna-muted">
            Optional hero background across the app.
          </p>

          <div class="mt-3 flex flex-wrap gap-1.5">
            <VeennaButton
              variant="muted"
              class="text-caption max-sm:flex-1"
              @click="theme.openBackgroundPicker()"
            >
              <PhImage class="h-3 w-3" />
              {{ hasBackground ? 'Change' : 'Choose' }}
            </VeennaButton>
            <VeennaButton
              v-if="hasBackground"
              variant="destructive"
              class="text-caption max-sm:flex-1"
              @click="clearBackground"
            >
              <PhTrash class="h-3 w-3" />
              Remove
            </VeennaButton>
          </div>

          <div
            class="mt-4 space-y-1.5"
            :class="hasBackground ? '' : 'pointer-events-none opacity-45'"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="text-caption font-medium text-veenna-muted">Background blur</p>
              <p class="tabular-nums text-caption text-veenna-muted">{{ wallpaperBlur }}px</p>
            </div>
            <input
              v-model.number="wallpaperBlur"
              type="range"
              class="wallpaper-blur-slider w-full"
              :min="WALLPAPER_BLUR_MIN"
              :max="WALLPAPER_BLUR_MAX"
              step="1"
              :disabled="!hasBackground"
              :aria-valuetext="`${wallpaperBlur} pixels`"
              aria-label="Wallpaper background blur"
            />
            <p class="text-caption text-veenna-muted">
              {{
                hasBackground
                  ? 'Softens the wallpaper behind pages.'
                  : 'Choose a wallpaper to adjust the blur.'
              }}
            </p>
          </div>
        </div>

        <div class="order-1 sm:order-2">
          <button
            v-if="hasBackground"
            type="button"
            class="group relative block aspect-[16/10] w-full overflow-hidden rounded-md bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--veenna-focus-line)]"
            aria-label="Preview wallpaper"
            title="Preview wallpaper"
            @click="openWallpaperPreview"
          >
            <span
              class="absolute inset-0 bg-cover bg-center transition-[filter,transform] duration-200"
              :style="wallpaperThumbStyle"
            />
            <span
              class="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/35 group-hover:opacity-100 group-focus-visible:bg-black/35 group-focus-visible:opacity-100"
            >
              <span
                class="flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-caption font-medium text-white"
              >
                <PhArrowsOut class="h-3 w-3" />
                Preview
              </span>
            </span>
          </button>
          <button
            v-else
            type="button"
            class="flex aspect-[16/10] w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-veenna-divider bg-muted/15 text-veenna-muted transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--veenna-focus-line)]"
            aria-label="Choose a wallpaper"
            @click="theme.openBackgroundPicker()"
          >
            <PhImage class="h-5 w-5 opacity-60" />
            <span class="text-caption">No wallpaper</span>
          </button>
        </div>
      </div>
    </section>

    <section :class="[veennaUi.settingsCard, veennaUi.settingsInset]">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 space-y-0.5">
          <SettingsRowTitle
            :hint="
              motionEnabled
                ? 'Page, scroll and graph animations are on.'
                : 'Animations are off: pages, transitions and the memory graph appear instantly and stay still.'
            "
            >Animations</SettingsRowTitle
          >
        </div>
        <Switch
          :model-value="motionEnabled"
          aria-label="Page and scroll animations"
          @update:model-value="theme.setMotionEnabled"
        />
      </div>
    </section>

    <section :class="[veennaUi.settingsCard, veennaUi.settingsInset, 'space-y-3']">
      <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div class="flex items-center gap-2">
          <p class="text-body font-medium text-veenna-foreground">Accent</p>
          <span
            class="h-4 w-4 shrink-0 rounded-full ring-1 ring-veenna-border/60"
            :style="{ backgroundColor: previewAccent }"
          />
        </div>
        <div class="flex items-center gap-2">
          <button
            v-if="hasCustomAccent"
            type="button"
            class="text-caption text-veenna-muted hover:text-veenna-accent"
            @click="resetAccents"
          >
            Reset accents
          </button>
          <button
            v-if="hasCustomTheme"
            type="button"
            class="text-caption text-veenna-muted hover:text-veenna-accent"
            @click="resetTheme"
          >
            Reset theme
          </button>
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <p class="mb-1.5 text-caption font-medium text-veenna-muted">Light mode</p>
          <div class="mb-1.5 flex flex-wrap gap-1">
            <button
              type="button"
              class="h-5 w-5 rounded-full border-2 transition-transform hover:scale-105"
              :class="!appearance.accentLight ? 'border-veenna-select-line' : 'border-transparent'"
              title="Default"
              @click="pickLight(null)"
            >
              <span
                class="block h-full w-full rounded-full"
                :style="{ backgroundColor: DEFAULT_ACCENT.light }"
              />
            </button>
            <button
              v-for="preset in ACCENT_COLOR_PRESETS"
              :key="`light-${preset}`"
              type="button"
              class="h-5 w-5 rounded-full border-2 transition-transform hover:scale-105"
              :class="
                appearance.accentLight === preset ? 'border-veenna-select-line' : 'border-transparent'
              "
              :style="{ backgroundColor: preset }"
              @click="pickLight(preset)"
            />
          </div>
          <Input
            v-model="accentLightInput"
            type="text"
            placeholder="#171717"
            class="veenna-field h-8 text-caption"
            @input="onLightInput"
            @change="onLightInput"
            @keydown.enter.prevent="onLightInput"
          />
        </div>

        <div>
          <p class="mb-1.5 text-caption font-medium text-veenna-muted">Dark mode</p>
          <div class="mb-1.5 flex flex-wrap gap-1">
            <button
              type="button"
              class="h-5 w-5 rounded-full border-2 transition-transform hover:scale-105"
              :class="!appearance.accentDark ? 'border-veenna-select-line' : 'border-transparent'"
              title="Default"
              @click="pickDark(null)"
            >
              <span
                class="block h-full w-full rounded-full"
                :style="{ backgroundColor: DEFAULT_ACCENT.dark }"
              />
            </button>
            <button
              v-for="preset in ACCENT_COLOR_PRESETS"
              :key="`dark-${preset}`"
              type="button"
              class="h-5 w-5 rounded-full border-2 transition-transform hover:scale-105"
              :class="
                appearance.accentDark === preset ? 'border-veenna-select-line' : 'border-transparent'
              "
              :style="{ backgroundColor: preset }"
              @click="pickDark(preset)"
            />
          </div>
          <Input
            v-model="accentDarkInput"
            type="text"
            placeholder="#ffffff"
            class="veenna-field h-8 text-caption"
            @input="onDarkInput"
            @change="onDarkInput"
            @keydown.enter.prevent="onDarkInput"
          />
        </div>
      </div>
    </section>

    <VeennaModal
      :open="wallpaperPreviewOpen"
      size="lg"
      :z-index="140"
      title-id="wallpaper-preview-title"
      panel-class="flex max-h-[min(90vh,720px)] flex-col overflow-hidden"
      @close="wallpaperPreviewOpen = false"
    >
      <ModalHeader
        title="Wallpaper"
        title-id="wallpaper-preview-title"
        size="sm"
        class="shrink-0"
        @close="wallpaperPreviewOpen = false"
      />
      <ModalBody compact class="!flex min-h-0 flex-1 items-center justify-center !overflow-auto">
        <img
          v-if="backgroundUrl"
          :src="backgroundUrl"
          alt="Wallpaper preview"
          class="max-h-[min(70vh,560px)] max-w-full rounded-md object-contain"
        />
      </ModalBody>
    </VeennaModal>
  </div>
</template>
