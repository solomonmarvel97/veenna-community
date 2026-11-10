<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NavItem, NavIconTile } from '@/components/veenna'
import { DICTATION_DEFAULT_PATH, isDictationPath } from '@/config/dictationTabs'
import { productNavDictationItem } from '@/config/productNav'
import { veennaUi } from '@/lib/veennaUi'
import { useResponsiveLayout } from '@/composables/useResponsiveLayout'

const route = useRoute()
const router = useRouter()
const { closeNav } = useResponsiveLayout()

const dictationActive = computed(() => isDictationPath(route.path))

function openDictation() {
  closeNav()
  void router.push(DICTATION_DEFAULT_PATH)
}
</script>

<template>
  <NavItem
    :class="veennaUi.navRow"
    variant="smart"
    :active="dictationActive"
    :title="productNavDictationItem.label"
    @click="openDictation"
  >
    <template #icon>
      <NavIconTile
        :icon="productNavDictationItem.icon"
        :color="productNavDictationItem.iconTile"
        variant="glyph"
        class="!size-4"
      />
    </template>
    {{ productNavDictationItem.label }}
  </NavItem>
</template>
