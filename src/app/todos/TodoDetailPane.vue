<script setup lang="ts">
import { formatRelative } from 'date-fns'
import {
  PhStar,
  PhCalendarBlank,
  PhArrowsClockwise,
  PhTrash,
  PhX,
  PhPlus,
  PhCheck,
} from '@phosphor-icons/vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useTodosStore, type TodoRecurrence } from '@/stores/todos'
import PaneFooter from '@/components/veenna/PaneFooter.vue'
import SegmentControl from '@/components/veenna/SegmentControl.vue'
import MobileTodoDetailHeader from './MobileTodoDetailHeader.vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const store = useTodosStore()
const stepTitle = ref('')
const stepInput = ref<InstanceType<typeof Input> | null>(null)
const taskTitle = ref('')
const displayCompleted = ref(false)
const notes = ref('')
const detailSection = ref<'todo' | 'notes'>('todo')
const dueDate = ref<string | null>(null)
const dueTime = ref<string | null>(null)
const recurrencePreset = ref('none')
let notesSaveTimer: ReturnType<typeof setTimeout> | null = null
let titleSaveTimer: ReturnType<typeof setTimeout> | null = null
let hydrating = false

const detailSections = [
  { id: 'todo' as const, label: 'Todo' },
  { id: 'notes' as const, label: 'Notes' },
]

const recurrencePresets: { id: string; label: string; value: TodoRecurrence | null }[] = [
  { id: 'none', label: 'Never', value: null },
  { id: 'daily', label: 'Daily', value: { freq: 'DAILY', interval: 1 } },
  { id: 'weekdays', label: 'Weekdays', value: { freq: 'WEEKLY', interval: 1, by_weekday: [1, 2, 3, 4, 5] } },
  { id: 'weekly', label: 'Weekly', value: { freq: 'WEEKLY', interval: 1 } },
  { id: 'monthly', label: 'Monthly', value: { freq: 'MONTHLY', interval: 1 } },
]

function presetFor(rule: TodoRecurrence | null): string {
  if (!rule) return 'none'
  if (rule.freq === 'DAILY') return 'daily'
  if (rule.freq === 'MONTHLY') return 'monthly'
  return rule.by_weekday?.length ? 'weekdays' : 'weekly'
}

const completeActionLabel = computed(() => (displayCompleted.value ? 'Mark incomplete' : 'Mark complete'))

function onToggleComplete() {
  const item = store.selectedItem
  if (!item) return
  displayCompleted.value = !displayCompleted.value
  store.setCompleted(item.id, displayCompleted.value)
}

watch(
  () => store.selectedItem?.id,
  () => {
    const item = store.selectedItem
    hydrating = true
    notes.value = item?.notes ?? ''
    taskTitle.value = item?.title ?? ''
    displayCompleted.value = item?.status === 'completed'
    dueDate.value = item?.due_date ?? null
    dueTime.value = item?.due_time ?? null
    recurrencePreset.value = presetFor(item?.recurrence ?? null)
    queueMicrotask(() => {
      hydrating = false
    })
  },
  { immediate: true },
)

function saveTitle() {
  const item = store.selectedItem
  const title = taskTitle.value.trim()
  if (!item || !title || title === item.title) return
  store.patchItem(item.id, { title })
}

watch(taskTitle, () => {
  if (hydrating) return
  if (titleSaveTimer) clearTimeout(titleSaveTimer)
  titleSaveTimer = setTimeout(() => {
    titleSaveTimer = null
    saveTitle()
  }, 500)
})

function saveNotes() {
  if (notesSaveTimer) {
    clearTimeout(notesSaveTimer)
    notesSaveTimer = null
  }
  const item = store.selectedItem
  if (item && notes.value.trim() !== (item.notes ?? '')) store.patchItem(item.id, { notes: notes.value })
}

watch(notes, () => {
  if (hydrating) return
  if (notesSaveTimer) clearTimeout(notesSaveTimer)
  notesSaveTimer = setTimeout(() => {
    notesSaveTimer = null
    saveNotes()
  }, 1100)
})

onBeforeUnmount(() => {
  if (notesSaveTimer) saveNotes()
  if (titleSaveTimer) {
    clearTimeout(titleSaveTimer)
    saveTitle()
  }
})

function addStep() {
  const item = store.selectedItem
  if (!item || !stepTitle.value.trim()) return
  store.addStep(item.id, stepTitle.value)
  stepTitle.value = ''
}

function setDueDate(value: string | null) {
  dueDate.value = value
  const item = store.selectedItem
  if (!item) return
  store.patchItem(item.id, { due_date: value || null })
  if (!value) dueTime.value = null
}

function setDueTime(value: string | null) {
  dueTime.value = value
  const item = store.selectedItem
  if (item) store.patchItem(item.id, { due_time: value })
}

function setRecurrence(presetId: unknown) {
  const item = store.selectedItem
  if (!item || presetId == null) return
  const id = String(presetId)
  recurrencePreset.value = id
  store.patchItem(item.id, { recurrence: recurrencePresets.find((p) => p.id === id)?.value ?? null })
}

const createdLabel = () => {
  const created = store.selectedItem?.created_at
  if (!created) return 'N/A'
  return formatRelative(new Date(created), new Date())
}
</script>

<template>
  <aside class="veenna-pane flex h-full min-h-0 flex-col no-drag">
    <MobileTodoDetailHeader />
    <header
      class="draggable-region flex h-12 shrink-0 items-center gap-2 border-b border-veenna-divider veenna-divide px-3"
    >
      <button
        v-if="store.selectedItem"
        type="button"
        class="inline-flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-body text-veenna-fg transition-colors hover:bg-veenna-row-hover"
        :aria-pressed="displayCompleted"
        :aria-label="completeActionLabel"
        @click="onToggleComplete"
      >
        <span
          class="veenna-task-ring flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
          :class="displayCompleted ? 'veenna-task-ring--done' : ''"
          aria-hidden="true"
        >
          <PhCheck v-if="displayCompleted" class="h-3 w-3" weight="bold" />
        </span>
        <span class="truncate">{{ completeActionLabel }}</span>
      </button>
      <span class="min-w-0 flex-1" />
      <button
        type="button"
        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-veenna-icon-muted transition-colors hover:bg-veenna-row-hover hover:text-veenna-icon"
        aria-label="Close"
        title="Close"
        @click="store.setDetailOpen(false)"
      >
        <PhX class="h-4 w-4" weight="bold" />
      </button>
    </header>

    <template v-if="store.selectedItem">
      <div class="flex items-center gap-2 border-b border-veenna-divider veenna-divide px-4 py-2.5">
        <Input
          v-model="taskTitle"
          type="text"
          class="veenna-field !h-9 !min-h-9 min-w-0 flex-1 rounded-md border-0 bg-transparent px-2.5 py-0 text-body leading-9 shadow-none focus-visible:border-transparent focus-visible:ring-0"
          :class="displayCompleted ? 'line-through text-veenna-secondary' : 'text-veenna-fg'"
          aria-label="Todo title"
          @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        />
        <button
          type="button"
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
          :class="
            store.selectedItem.is_important
              ? 'text-veenna-star-active'
              : 'text-veenna-star hover:text-veenna-star-active'
          "
          :aria-label="store.selectedItem.is_important ? 'Remove star' : 'Star'"
          @click="store.toggleImportant(store.selectedItem.id)"
        >
          <PhStar class="h-4 w-4" :weight="store.selectedItem.is_important ? 'fill' : 'regular'" />
        </button>
      </div>

      <div class="shrink-0 px-4 py-3">
        <SegmentControl v-model="detailSection" :options="detailSections" />
      </div>

      <div
        v-show="detailSection === 'todo'"
        class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-1 text-body pb-safe sm:px-4"
      >
        <button
          type="button"
          class="flex items-center gap-2 text-veenna-accent hover:opacity-90"
          @click="stepInput?.$el?.focus?.()"
        >
          <PhPlus class="h-4 w-4" weight="bold" />
          Add Step
        </button>
        <Input
          ref="stepInput"
          v-model="stepTitle"
          type="text"
          placeholder="Step title"
          class="veenna-field"
          @keydown.enter="addStep"
        />
        <ul class="space-y-1">
          <li
            v-for="step in store.selectedItem.steps"
            :key="step.id"
            class="group flex items-center gap-2 text-veenna-fg"
          >
            <Checkbox
              :checked="step.is_completed"
              @update:checked="store.toggleStep(store.selectedItem!.id, step.id)"
            />
            <span
              class="min-w-0 flex-1"
              :class="step.is_completed ? 'line-through text-veenna-secondary' : ''"
              >{{ step.title }}</span
            >
            <button
              type="button"
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-veenna-icon-muted opacity-0 transition-opacity hover:bg-veenna-row-hover hover:text-veenna-fg group-hover:opacity-100"
              aria-label="Delete step"
              @click="store.removeStep(store.selectedItem!.id, step.id)"
            >
              <PhX class="h-3.5 w-3.5" />
            </button>
          </li>
        </ul>

        <Label class="flex items-center gap-2 text-veenna-fg">
          <PhCalendarBlank class="h-4 w-4 text-veenna-icon-muted" /> Due date
        </Label>
        <DatePicker :model-value="dueDate" placeholder="Pick due date" @update:model-value="setDueDate" />
        <TimePicker
          v-if="dueDate"
          :model-value="dueTime"
          placeholder="Pick due time"
          @update:model-value="setDueTime"
        />

        <Label class="flex items-center gap-2 text-veenna-fg">
          <PhArrowsClockwise class="h-4 w-4 text-veenna-icon-muted" /> Repeat
        </Label>
        <p v-if="recurrencePreset !== 'none' && !dueDate" class="text-caption text-veenna-muted">
          Pick a due date so the next one knows when to come back.
        </p>
        <Select :model-value="recurrencePreset" @update:model-value="setRecurrence">
          <SelectTrigger>
            <SelectValue placeholder="Never" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="p in recurrencePresets" :key="p.id" :value="p.id">
              {{ p.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div
        v-if="detailSection === 'notes'"
        class="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-3 sm:px-4"
      >
        <textarea
          v-model="notes"
          class="veenna-field min-h-0 w-full flex-1 resize-none rounded-md p-3 text-body"
          placeholder="Write notes…"
          aria-label="Notes"
          @blur="saveNotes"
        />
      </div>
    </template>

    <PaneFooter
      v-if="store.selectedItem"
      class="justify-between px-4 text-body text-veenna-muted max-lg:hidden"
    >
      <span class="truncate text-caption leading-none">Created {{ createdLabel() }}</span>
      <button
        type="button"
        class="flex h-7 w-7 shrink-0 items-center justify-center text-veenna-icon-muted hover:text-red-400"
        aria-label="Delete todo"
        @click="store.removeItem(store.selectedItem.id)"
      >
        <PhTrash class="h-4 w-4" />
      </button>
    </PaneFooter>
  </aside>
</template>
