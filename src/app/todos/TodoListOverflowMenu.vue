<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { TODO_SORTS, useTodosStore, type TodoSort } from '@/stores/todos'

const emit = defineEmits<{ close: []; select: []; clearCompleted: [] }>()
const store = useTodosStore()

function pick(sort: TodoSort) {
  store.setSortBy(sort)
  emit('close')
}

function startSelecting() {
  emit('select')
  emit('close')
}

function clearCompleted() {
  emit('clearCompleted')
  emit('close')
}

function toggleCompleted() {
  store.setShowCompleted(!store.showCompleted)
  emit('close')
}
</script>

<template>
  <DropdownMenuContent align="end">
    <DropdownMenuLabel class="text-veenna-muted">Sort by</DropdownMenuLabel>
    <DropdownMenuItem
      v-for="s in TODO_SORTS"
      :key="s.id"
      :class="store.sortBy === s.id ? 'text-veenna-accent' : ''"
      @click="pick(s.id)"
    >
      {{ s.label }}
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem @click="toggleCompleted">
      {{ store.showCompleted ? 'Hide completed' : 'Show completed' }}
    </DropdownMenuItem>
    <DropdownMenuItem :disabled="!store.sortedItems.length" @click="startSelecting">
      Select todos
    </DropdownMenuItem>
    <DropdownMenuItem
      destructive
      :disabled="!store.completedItemIds.length"
      @click="clearCompleted"
    >
      Clear completed
    </DropdownMenuItem>
  </DropdownMenuContent>
</template>
