<script setup lang="ts">
import type { Component } from 'vue'
import { PhAndroidLogo, PhDesktop, PhLinuxLogo, PhWindowsLogo } from '@phosphor-icons/vue'
import AppleMark from '@/components/app/AppleMark.vue'
import { detectAppPlatform, type AppPlatformId } from '@/lib/platform/appPlatform'

const ICONS: Record<AppPlatformId, Component> = {
  macos: AppleMark,
  ios: AppleMark,
  windows: PhWindowsLogo,
  linux: PhLinuxLogo,
  android: PhAndroidLogo,
  other: PhDesktop,
}

const platform = detectAppPlatform()
</script>

<template>
  <span class="inline-flex shrink-0 items-center gap-1.5 text-label text-veenna-muted">
    <component
      :is="ICONS[platform.id]"
      class="h-3.5 w-3.5 shrink-0"
      weight="fill"
      aria-hidden="true"
    />
    <span>{{ platform.label }}</span>
  </span>
</template>
