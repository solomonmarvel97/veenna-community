<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { PhStar, PhCheck, PhArrowsClockwise, PhCopy, PhDotsThree, PhTrash } from '@phosphor-icons/vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/toast/use-toast'
import { writeClipboardText } from '@/lib/clipboard/writeClipboardText'
import { formatTaskScheduleLabel } from '@/lib/dateUtils'
import type { TodoItem } from '@/stores/todos'

const props = defineProps<{
  item: TodoItem
  selected?: boolean
  /** Picking todos for a bulk action: a click ticks the row instead of opening it. */
  selectMode?: boolean
  /** Ticked while in select mode. */
  checked?: boolean
}>()

const emit = defineEmits<{
  select: []
  check: [MouseEvent]
  toggleComplete: []
  toggleImportant: []
  delete: []
}>()

const { toast } = useToast()
const actionsOpen = ref(false)

const displayCompleted = ref(props.item.status === 'completed')
const displayImportant = ref(props.item.is_important)

watch(
  () => props.item.status,
  (status) => {
    displayCompleted.value = status === 'completed'
  },
)

watch(
  () => props.item.is_important,
  (isImportant) => {
    displayImportant.value = isImportant
  },
)

const scheduleLabel = computed(() => formatTaskScheduleLabel(props.item))

function onRowClick(event: MouseEvent) {
  if (props.selectMode) {
    emit('check', event)
    return
  }
  emit('select')
}

function onToggleComplete(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  displayCompleted.value = !displayCompleted.value
  emit('toggleComplete')
}

function onToggleImportant(event: MouseEvent) {
  event.preventDefault()
  displayImportant.value = !displayImportant.value
  emit('toggleImportant')
}

async function onCopy() {
  const copied = await writeClipboardText(props.item.title)
  toast({ title: copied ? 'Todo copied' : 'Could not copy the todo' })
}
</script>

<template>
  <div
    class="veenna-touch-target veenna-task-row mb-1 flex cursor-pointer items-center gap-3 rounded-md px-3 py-3 transition-[background-color,transform] duration-motion-fast ease-motion-standard hover:bg-veenna-row-hover active:scale-[0.998] sm:py-2.5"
    :class="[selectMode ? 'select-none' : '', selected ? 'bg-veenna-row' : '']"
    :role="selectMode ? 'checkbox' : undefined"
    :aria-checked="selectMode ? checked : undefined"
    @click="onRowClick"
  >
    <span
      v-if="selectMode"
      class="flex h-6 w-6 shrink-0 items-center justify-center sm:h-5 sm:w-5"
      aria-hidden="true"
    >
      <span
        class="flex size-4 items-center justify-center rounded-[5px] border"
        :class="
          checked
            ? 'border-veenna-accent bg-veenna-accent text-veenna-accent-fg'
            : 'border-veenna-border bg-veenna-panel'
        "
      >
        <PhCheck v-if="checked" class="size-3" weight="bold" />
      </span>
    </span>
    <button
      v-else
      type="button"
      class="veenna-task-ring flex h-6 w-6 shrink-0 items-center justify-center rounded-md sm:h-5 sm:w-5"
      :class="displayCompleted ? 'veenna-task-ring--done' : ''"
      :aria-label="displayCompleted ? 'Mark incomplete' : 'Mark complete'"
      @click.stop="onToggleComplete"
    >
      <PhCheck v-show="displayCompleted" class="h-3.5 w-3.5 sm:h-3 sm:w-3" weight="bold" />
    </button>
    <div class="flex min-w-0 flex-1 items-baseline gap-2">
      <p
        class="min-w-0 truncate text-body"
        :class="displayCompleted ? 'veenna-task-title--done' : 'text-veenna-fg'"
      >
        {{ item.title }}
      </p>
      <p
        v-if="scheduleLabel || item.recurrence"
        class="flex shrink-0 items-center gap-1.5 self-center whitespace-nowrap text-caption text-veenna-muted"
      >
        <PhArrowsClockwise v-if="item.recurrence" class="h-3 w-3 shrink-0" />
        <span v-if="scheduleLabel" class="min-w-0 truncate">{{ scheduleLabel }}</span>
      </p>
    </div>
    <button
      v-if="!selectMode"
      type="button"
      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md sm:h-8 sm:w-8 sm:p-1"
      :class="
        displayImportant ? 'text-veenna-star-active' : 'text-veenna-star hover:text-veenna-star-active'
      "
      :aria-label="displayImportant ? 'Remove star' : 'Star'"
      @click.stop="onToggleImportant"
    >
      <PhStar class="h-4 w-4" :weight="displayImportant ? 'fill' : 'regular'" />
    </button>
    <DropdownMenu v-if="!selectMode" v-model:open="actionsOpen">
      <DropdownMenuTrigger as-child>
        <button
          type="button"
          class="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-veenna-icon-muted transition-colors hover:text-veenna-icon sm:h-8 sm:w-8"
          :class="actionsOpen ? 'text-veenna-icon' : ''"
          aria-label="Todo actions"
          @click.stop
        >
          <PhDotsThree class="h-4 w-4" weight="bold" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" @click.stop>
        <DropdownMenuItem @select="onCopy">
          <PhCopy class="h-4 w-4" />
          Copy
        </DropdownMenuItem>
        <DropdownMenuItem destructive @select="emit('delete')">
          <PhTrash class="h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>

<style scoped>
.veenna-task-row {
  contain: layout style;
}

.veenna-task-title--done {
  color: var(--veenna-secondary);
  text-decoration: line-through;
  text-decoration-thickness: 1px;
  text-decoration-color: color-mix(in srgb, var(--veenna-secondary) 70%, transparent);
}
</style>
