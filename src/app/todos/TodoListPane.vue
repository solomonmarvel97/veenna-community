<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { PhCaretDown } from '@phosphor-icons/vue'
import { useTodosStore } from '@/stores/todos'
import { groupTodosByDay } from '@/lib/todoDayGroups'
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import TodoRow from './TodoRow.vue'
import AddTodoInput from './AddTodoInput.vue'
import TodoListOverflowMenu from './TodoListOverflowMenu.vue'
import { bulkDeleteTitle, nextTaskSelection } from './todoSelection'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { HairlineChecklist } from '@/components/hairline'
import { useToast } from '@/components/ui/toast/use-toast'
import { veennaUi } from '@/lib/veennaUi'

const store = useTodosStore()
const { toast } = useToast()

/** The main half of the list-options split button: toggles completed todos. */
const overflowDefault = computed(() =>
  store.showCompleted
    ? { label: 'Hide completed', title: 'Hide completed todos', run: () => store.setShowCompleted(false) }
    : { label: 'Show completed', title: 'Show completed todos', run: () => store.setShowCompleted(true) },
)
const menuOpen = ref(false)

const dayGroups = computed(() => groupTodosByDay(store.sortedItems))
const visibleIds = computed(() => dayGroups.value.flatMap((group) => group.items.map((i) => i.id)))

// Select mode: tick rows, then delete them together.
const selecting = ref(false)
const checkedIds = ref<Set<string>>(new Set())
const selectionAnchor = ref<string | null>(null)
const checkedCount = computed(() => visibleIds.value.filter((id) => checkedIds.value.has(id)).length)
const allChecked = computed(
  () => visibleIds.value.length > 0 && checkedCount.value === visibleIds.value.length,
)

function startSelecting() {
  selecting.value = true
  checkedIds.value = new Set()
  selectionAnchor.value = null
  store.setDetailOpen(false)
}

function stopSelecting() {
  selecting.value = false
  checkedIds.value = new Set()
  selectionAnchor.value = null
}

function checkRow(id: string, event: MouseEvent) {
  checkedIds.value = nextTaskSelection(checkedIds.value, visibleIds.value, id, {
    anchorId: selectionAnchor.value,
    range: event.shiftKey,
  })
  selectionAnchor.value = id
}

function toggleAll() {
  checkedIds.value = allChecked.value ? new Set() : new Set(visibleIds.value)
}

// One confirm for both bulk deletes: the ticked rows, or every completed todo.
const pendingDelete = ref<{ title: string; description: string; run: () => void } | null>(null)
const confirmOpen = ref(false)

function ask(title: string, description: string, run: () => void) {
  pendingDelete.value = { title, description, run }
  confirmOpen.value = true
}

function askDeleteChecked() {
  const ids = visibleIds.value.filter((id) => checkedIds.value.has(id))
  if (!ids.length) return
  ask(bulkDeleteTitle(ids.length), 'This can’t be undone.', () => {
    stopSelecting()
    const count = store.removeItems(ids)
    toast({ title: count === 1 ? '1 todo deleted' : `${count} todos deleted` })
  })
}

function askClearCompleted() {
  const ids = store.completedItemIds
  if (!ids.length) return
  ask(bulkDeleteTitle(ids.length, true), 'This can’t be undone.', () => {
    const count = store.removeItems(ids)
    toast({ title: count === 1 ? '1 todo deleted' : `${count} todos deleted` })
  })
}

function confirmDelete() {
  const request = pendingDelete.value
  pendingDelete.value = null
  confirmOpen.value = false
  request?.run()
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')
}

function onSelectKeydown(event: KeyboardEvent) {
  if (!selecting.value || confirmOpen.value || isTyping(event.target)) return
  if (event.key === 'Escape') {
    event.preventDefault()
    stopSelecting()
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    askDeleteChecked()
  }
}

watch(selecting, (on) => {
  if (on) window.addEventListener('keydown', onSelectKeydown)
  else window.removeEventListener('keydown', onSelectKeydown)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onSelectKeydown))

const emptyStateTitle = computed(() =>
  store.selectedList ? `${store.activeTitle} is empty` : 'No todos yet',
)
const emptyStateHint = computed(() =>
  store.selectedList ? 'Add a todo below to fill this list.' : 'Add your first todo in the field below.',
)

const showEmptyState = computed(() => store.loaded && !store.sortedItems.length)
</script>

<template>
  <section class="veenna-list-pane relative flex h-full min-h-0 flex-col no-drag">
    <header class="flex items-start justify-between gap-2 px-3 pb-2 pt-2 sm:pt-3">
      <div class="flex min-w-0 flex-1 items-start gap-1 sm:gap-2">
        <div class="min-w-0 flex-1">
          <h1 :class="[veennaUi.pageTitle, 'text-veenna-accent']">
            {{ store.activeTitle }}
          </h1>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <div
          v-if="selecting"
          class="flex shrink-0 items-center gap-1"
          role="toolbar"
          aria-label="Selected todos"
        >
          <span class="px-2 text-caption text-veenna-muted" aria-live="polite">
            {{ checkedCount }} selected
          </span>
          <Button size="sm" variant="flatMuted" @click="toggleAll">
            {{ allChecked ? 'Select none' : 'Select all' }}
          </Button>
          <Button size="sm" variant="destructive" :disabled="!checkedCount" @click="askDeleteChecked">
            Delete
          </Button>
          <Button size="sm" variant="flatMuted" @click="stopSelecting">Cancel</Button>
        </div>
        <div v-else class="flex shrink-0 items-stretch">
          <Button
            size="sm"
            variant="flatMuted"
            class="rounded-l-[4px] rounded-r-none"
            :title="overflowDefault.title"
            @click="overflowDefault.run"
          >
            {{ overflowDefault.label }}
          </Button>
          <DropdownMenu v-model:open="menuOpen">
            <DropdownMenuTrigger as-child>
              <Button
                size="sm"
                variant="flatMuted"
                class="ml-px rounded-l-none rounded-r-[4px] px-1.5"
                aria-label="List options"
                title="List options"
              >
                <PhCaretDown class="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <TodoListOverflowMenu
              @close="menuOpen = false"
              @select="startSelecting"
              @clear-completed="askClearCompleted"
            />
          </DropdownMenu>
        </div>
      </div>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto pb-2">
      <div class="relative px-2 sm:px-3">
        <section v-for="group in dayGroups" :key="group.dayKey" class="mb-4 last:mb-0">
          <h2 class="px-1 py-2 text-label font-medium uppercase tracking-overline text-veenna-muted">
            {{ group.label }}
          </h2>
          <div class="space-y-1">
            <TodoRow
              v-for="item in group.items"
              :key="item.id"
              :item="item"
              :selected="store.selectedItemId === item.id"
              :select-mode="selecting"
              :checked="checkedIds.has(item.id)"
              @select="store.selectItem(item.id)"
              @check="checkRow(item.id, $event)"
              @toggle-complete="store.setCompleted(item.id, item.status !== 'completed')"
              @toggle-important="store.toggleImportant(item.id)"
              @delete="store.removeItem(item.id)"
            />
          </div>
        </section>
      </div>
      <div
        v-if="showEmptyState"
        class="flex flex-col items-center py-6 text-center [--hairline-plate:var(--veenna-bg)]"
      >
        <!-- The figure's viewBox ends well below the drawing, so the title rises into that margin. -->
        <HairlineChecklist class="-mb-4 w-[200px]" play />
        <p class="text-title-sm font-medium text-veenna-fg">{{ emptyStateTitle }}</p>
        <p class="mt-1 text-caption text-veenna-muted">{{ emptyStateHint }}</p>
      </div>
    </div>

    <footer class="pane-footer flex w-full items-center px-3">
      <div class="veenna-add-task-bar flex w-full items-center gap-2 px-3 py-1.5">
        <AddTodoInput class="w-full" />
      </div>
    </footer>

    <AlertDialog v-model:open="confirmOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ pendingDelete?.title }}</AlertDialogTitle>
          <AlertDialogDescription>{{ pendingDelete?.description }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction action-variant="destructive" @click="confirmDelete">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
</template>
