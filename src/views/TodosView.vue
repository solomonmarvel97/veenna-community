<script setup lang="ts">
import { onMounted } from 'vue'
import AppPageShell from '@/components/app/AppPageShell.vue'
import TodoShell from '@/app/todos/TodoShell.vue'
import { useTodosStore } from '@/stores/todos'

defineOptions({ name: 'TodosView' })

const store = useTodosStore()

onMounted(() => {
  void store.load()
})
</script>

<template>
  <AppPageShell transparent fill hide-breadcrumb hide-top-search class="!overflow-hidden">
    <TodoShell class="veenna-productivity-shell flex h-full min-h-0 w-full flex-1 overflow-hidden" />
  </AppPageShell>
</template>
