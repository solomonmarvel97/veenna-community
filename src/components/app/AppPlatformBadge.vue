<script setup lang="ts">
import type { Component } from 'vue'
import { PhDesktop } from '@phosphor-icons/vue'
import AndroidMark from '@/components/app/AndroidMark.vue'
import AppleMark from '@/components/app/AppleMark.vue'
import LinuxMark from '@/components/app/LinuxMark.vue'
import WindowsMark from '@/components/app/WindowsMark.vue'
import { detectAppPlatform, type AppPlatformId } from '@/lib/platform/appPlatform'

/** Each platform shows its real logo in its own colours. Apple's is one solid colour, so it takes the foreground. */
const ICONS: Record<AppPlatformId, Component> = {
  macos: AppleMark,
  ios: AppleMark,
  windows: WindowsMark,
  linux: LinuxMark,
  android: AndroidMark,
  other: PhDesktop,
}

const COLORED: Record<AppPlatformId, string> = {
  macos: 'text-veenna-foreground',
  ios: 'text-veenna-foreground',
  windows: '',
  linux: '',
  android: '',
  other: 'text-veenna-muted',
}

const platform = detectAppPlatform()
</script>

<template>
  <span class="inline-flex shrink-0 items-center gap-1.5 text-label text-veenna-muted">
    <component
      :is="ICONS[platform.id]"
      :class="['h-4 w-4 shrink-0', COLORED[platform.id]]"
      weight="fill"
      aria-hidden="true"
    />
    <span>{{ platform.label }}</span>
  </span>
</template>
