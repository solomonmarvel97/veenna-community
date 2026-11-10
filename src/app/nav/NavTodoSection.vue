<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NavItem, NavIconTile } from '@/components/veenna'
import { productNavTodoItem } from '@/config/productNav'
import { veennaUi } from '@/lib/veennaUi'
import { useResponsiveLayout } from '@/composables/useResponsiveLayout'
import { useTodosStore } from '@/stores/todos'

const route = useRoute()
const router = useRouter()
const store = useTodosStore()
const { closeNav } = useResponsiveLayout()

const active = computed(() => route.path === productNavTodoItem.path)

onMounted(() => {
  void store.load()
})

function open() {
  closeNav()
  store.selectList(null)
  if (!active.value) void router.push(productNavTodoItem.path)
}
</script>

<template>
  <NavItem :class="veennaUi.navRow" variant="smart" :active="active" @click="open">
    <template #icon>
      <NavIconTile
        :icon="productNavTodoItem.icon"
        :color="productNavTodoItem.iconTile"
        variant="glyph"
        class="!size-4"
      />
    </template>
    {{ productNavTodoItem.label }}
    <template v-if="store.totalOpen" #trailing>{{ store.totalOpen }}</template>
  </NavItem>
</template>
