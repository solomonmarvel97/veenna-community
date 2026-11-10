<script setup lang="ts">
import { ref } from 'vue'
import { PhPlus } from '@phosphor-icons/vue'
import { Input } from '@/components/ui/input'
import { useTodosStore } from '@/stores/todos'

defineProps<{ disabled?: boolean }>()

const store = useTodosStore()
const title = ref('')

function submit() {
  const t = title.value.trim()
  if (!t) return
  title.value = ''
  store.addItem(t)
}
</script>

<template>
  <div
    class="flex w-full items-center gap-2 leading-none"
    :class="disabled ? 'pointer-events-none opacity-50' : ''"
  >
    <PhPlus class="h-4 w-4 shrink-0 text-veenna-accent" weight="bold" />
    <Input
      id="add-todo-input"
      v-model="title"
      type="text"
      placeholder="Add a Todo"
      :disabled="disabled"
      class="veenna-field-ghost !h-8 !min-h-0 min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-body leading-none shadow-none outline-none focus:outline-none focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
      @keydown.enter="submit"
    />
  </div>
</template>
