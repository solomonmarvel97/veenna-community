<script setup lang="ts">
import { PhCaretLeft, PhTrash } from '@phosphor-icons/vue'
import { useTodosStore } from '@/stores/todos'
import MobileNavButton from '@/app/nav/MobileNavButton.vue'
import { confirm } from '@/composables/useConfirmDialog'

const store = useTodosStore()

function goBack() {
  store.setDetailOpen(false)
}

async function deleteTask() {
  const item = store.selectedItem
  if (!item) return
  const ok = await confirm({
    title: 'Delete this todo?',
    confirmLabel: 'Delete',
    destructive: true,
  })
  if (ok) store.removeItem(item.id)
}
</script>

<template>
  <header
    class="safe-top flex h-12 shrink-0 items-center gap-1 border-b border-veenna-divider veenna-divide px-2 pt-safe lg:hidden"
  >
    <MobileNavButton />
    <button
      type="button"
      class="flex h-10 w-10 items-center justify-center rounded-md text-veenna-icon-muted transition-colors hover:bg-veenna-row-hover hover:text-veenna-icon"
      aria-label="Back to todo list"
      @click="goBack"
    >
      <PhCaretLeft class="h-5 w-5" weight="bold" />
    </button>
    <span class="min-w-0 flex-1 truncate text-body font-medium text-veenna-fg">Todo details</span>
    <button
      v-if="store.selectedItem"
      type="button"
      class="flex h-10 w-10 items-center justify-center rounded-md text-veenna-icon-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
      aria-label="Delete todo"
      @click="deleteTask"
    >
      <PhTrash class="h-5 w-5" />
    </button>
  </header>
</template>
