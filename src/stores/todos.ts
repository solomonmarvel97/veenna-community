import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { addDays, addMonths, addWeeks, format, getDay, parseISO } from 'date-fns'
import { isElectron } from '@/lib/platform/isElectron'
import { LOCAL_OWNER_ID } from '@/lib/localOwner'
import {
  listLocalEntities,
  mirrorLocalEntity,
  openLocalStore,
  removeLocalEntity,
} from '@/lib/localStore/localStoreClient'

/**
 * Todo on this device. Lists and tasks live in the local database only; nothing is uploaded.
 * The field names match the full Veenna app's tasks, so the .veennapack export hands them over as is.
 */
export type TodoList = {
  id: string
  name: string
  sort_order: number
  created_at: string
  updated_at: string
}

export type TodoStep = {
  id: string
  title: string
  is_completed: boolean
  sort_order: number
}

export type TodoRecurrence = {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  interval: number
  /** 0 = Sunday ... 6 = Saturday; set for "Weekdays". */
  by_weekday?: number[]
}

export type TodoSort = 'created' | 'importance' | 'due_date' | 'alpha'

export const TODO_SORTS: { id: TodoSort; label: string }[] = [
  { id: 'created', label: 'Newest first' },
  { id: 'importance', label: 'Importance' },
  { id: 'due_date', label: 'Due date' },
  { id: 'alpha', label: 'Alphabetically' },
]

export type TodoItem = {
  id: string
  list_id: string
  title: string
  notes: string | null
  status: 'active' | 'completed'
  is_important: boolean
  /** `YYYY-MM-DD`, or null. */
  due_date: string | null
  /** `HH:MM`, or null. Only meaningful with a due date. */
  due_time: string | null
  /** How the task comes back once it is completed; null for a one-off. */
  recurrence: TodoRecurrence | null
  completed_at: string | null
  sort_order: number
  steps: TodoStep[]
  created_at: string
  updated_at: string
}

const DEFAULT_LIST_NAME = 'Tasks'
const UI_KEY = 'veenna.todo.ui'

function newId(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function toList(payload: Record<string, unknown>): TodoList | null {
  const id = text(payload.id).trim()
  const name = text(payload.name).trim()
  if (!id || !name) return null
  const created = text(payload.created_at) || now()
  return {
    id,
    name,
    sort_order: Number(payload.sort_order) || 0,
    created_at: created,
    updated_at: text(payload.updated_at) || created,
  }
}

function toStep(raw: unknown, index: number): TodoStep | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const title = text(row.title).trim()
  if (!title) return null
  return {
    id: text(row.id) || newId(),
    title,
    is_completed: row.is_completed === true,
    sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : index,
  }
}

function toRecurrence(raw: unknown): TodoRecurrence | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const freq = row.freq
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY') return null
  const weekdays = Array.isArray(row.by_weekday)
    ? row.by_weekday.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : []
  return {
    freq,
    interval: Math.max(1, Number(row.interval) || 1),
    ...(weekdays.length ? { by_weekday: weekdays } : {}),
  }
}

/** The next due day for a recurring task, as `YYYY-MM-DD`. */
function nextDueDate(from: string, rule: TodoRecurrence): string {
  const base = parseISO(from.length > 10 ? from : `${from}T12:00:00`)
  let next = base
  if (rule.freq === 'DAILY') next = addDays(base, rule.interval)
  else if (rule.freq === 'MONTHLY') next = addMonths(base, rule.interval)
  else if (rule.by_weekday?.length) {
    next = addDays(base, 1)
    while (!rule.by_weekday.includes(getDay(next))) next = addDays(next, 1)
  } else next = addWeeks(base, rule.interval)
  return format(next, 'yyyy-MM-dd')
}

function toItem(payload: Record<string, unknown>): TodoItem | null {
  const id = text(payload.id).trim()
  const listId = text(payload.list_id).trim()
  const title = text(payload.title).trim()
  if (!id || !listId || !title) return null
  const created = text(payload.created_at) || now()
  const steps = (Array.isArray(payload.steps) ? payload.steps : [])
    .map((step, index) => toStep(step, index))
    .filter((step): step is TodoStep => step != null)
  return {
    id,
    list_id: listId,
    title,
    notes: text(payload.notes).trim() || null,
    status: payload.status === 'completed' ? 'completed' : 'active',
    is_important: payload.is_important === true,
    due_date: text(payload.due_date).trim() || null,
    due_time: text(payload.due_time).trim().slice(0, 5) || null,
    recurrence: toRecurrence(payload.recurrence),
    completed_at: text(payload.completed_at) || null,
    sort_order: Number(payload.sort_order) || 0,
    steps,
    created_at: created,
    updated_at: text(payload.updated_at) || created,
  }
}

export const useTodosStore = defineStore('todos', () => {
  const lists = ref<TodoList[]>([])
  const items = ref<TodoItem[]>([])
  const loaded = ref(false)
  /** The list on show; null is "Todo", every task across the lists. */
  const selectedListId = ref<string | null>(null)
  const selectedItemId = ref<string | null>(null)
  const detailOpen = ref(false)
  const sortBy = ref<TodoSort>('created')
  const showCompleted = ref(true)
  let loading: Promise<void> | null = null

  const sortedLists = computed(() =>
    [...lists.value].sort(
      (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
    ),
  )

  const selectedList = computed(() =>
    selectedListId.value ? (lists.value.find((list) => list.id === selectedListId.value) ?? null) : null,
  )

  const defaultList = computed(() => sortedLists.value[0] ?? null)

  const activeTitle = computed(() => selectedList.value?.name ?? 'Todo')

  function compareBy(sort: TodoSort) {
    return (a: TodoItem, b: TodoItem): number => {
      if (sort === 'alpha') return a.title.localeCompare(b.title)
      if (sort === 'importance' && a.is_important !== b.is_important) return a.is_important ? -1 : 1
      if (sort === 'due_date') {
        if (a.due_date !== b.due_date) {
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return a.due_date.localeCompare(b.due_date)
        }
      }
      return b.created_at.localeCompare(a.created_at)
    }
  }

  /** What the list shows: this list (or all), completed ones when asked for, in the chosen order. */
  const sortedItems = computed(() => {
    const listId = selectedList.value?.id
    return items.value
      .filter((item) => (listId ? item.list_id === listId : true))
      .filter((item) => showCompleted.value || item.status !== 'completed')
      .slice()
      .sort(compareBy(sortBy.value))
  })

  const completedItemIds = computed(() =>
    sortedItems.value.filter((item) => item.status === 'completed').map((item) => item.id),
  )

  const selectedItem = computed(
    () => items.value.find((item) => item.id === selectedItemId.value) ?? null,
  )

  const totalOpen = computed(() => items.value.filter((item) => item.status === 'active').length)

  function readUi() {
    try {
      const parsed = JSON.parse(localStorage.getItem(UI_KEY) || '{}') as {
        sortBy?: string
        showCompleted?: unknown
      }
      if (TODO_SORTS.some((entry) => entry.id === parsed.sortBy)) sortBy.value = parsed.sortBy as TodoSort
      if (typeof parsed.showCompleted === 'boolean') showCompleted.value = parsed.showCompleted
    } catch {
      /* defaults */
    }
  }

  function writeUi() {
    try {
      localStorage.setItem(
        UI_KEY,
        JSON.stringify({ sortBy: sortBy.value, showCompleted: showCompleted.value }),
      )
    } catch {
      /* the view just resets next launch */
    }
  }

  function setSortBy(sort: TodoSort) {
    sortBy.value = sort
    writeUi()
  }

  function setShowCompleted(show: boolean) {
    showCompleted.value = show
    writeUi()
  }

  function openCount(listId: string): number {
    return items.value.filter((item) => item.list_id === listId && item.status === 'active').length
  }

  function saveList(list: TodoList) {
    mirrorLocalEntity('todo_list', list.id, { ...list }, list.updated_at)
  }

  function saveItem(item: TodoItem) {
    mirrorLocalEntity('todo_item', item.id, { ...item, steps: item.steps.map((s) => ({ ...s })) }, item.updated_at)
  }

  function ensureDefaultList() {
    if (lists.value.length) return
    const stamp = now()
    const list: TodoList = {
      id: newId(),
      name: DEFAULT_LIST_NAME,
      sort_order: 0,
      created_at: stamp,
      updated_at: stamp,
    }
    lists.value = [list]
    saveList(list)
  }

  async function load(): Promise<void> {
    if (loaded.value) return
    if (loading) return loading
    loading = (async () => {
      try {
        if (isElectron) {
          await openLocalStore(LOCAL_OWNER_ID)
          const result = await listLocalEntities({ types: ['todo_list', 'todo_item'] })
          const nextLists: TodoList[] = []
          const nextItems: TodoItem[] = []
          for (const entity of result.entities ?? []) {
            if (!entity.payload) continue
            if (entity.type === 'todo_list') {
              const list = toList(entity.payload)
              if (list) nextLists.push(list)
            } else if (entity.type === 'todo_item') {
              const item = toItem(entity.payload)
              if (item) nextItems.push(item)
            }
          }
          lists.value = nextLists
          items.value = nextItems
        }
        ensureDefaultList()
        readUi()
      } finally {
        loaded.value = true
        loading = null
      }
    })()
    return loading
  }

  /** Shows one list, or every task when `id` is null. Closes the detail pane. */
  function selectList(id: string | null) {
    selectedListId.value = id
    selectedItemId.value = null
    detailOpen.value = false
  }

  function selectItem(id: string) {
    selectedItemId.value = id
    detailOpen.value = true
  }

  function setDetailOpen(open: boolean) {
    detailOpen.value = open
    if (!open) selectedItemId.value = null
  }

  function addList(name: string): TodoList | null {
    const clean = name.trim()
    if (!clean) return null
    const stamp = now()
    const list: TodoList = {
      id: newId(),
      name: clean,
      sort_order: lists.value.reduce((max, l) => Math.max(max, l.sort_order), 0) + 1,
      created_at: stamp,
      updated_at: stamp,
    }
    lists.value = [...lists.value, list]
    saveList(list)
    selectList(list.id)
    return list
  }

  function renameList(id: string, name: string) {
    const clean = name.trim()
    const list = lists.value.find((entry) => entry.id === id)
    if (!list || !clean || clean === list.name) return
    list.name = clean
    list.updated_at = now()
    saveList(list)
  }

  /** Removes the list and every task in it. The last list cannot be removed. */
  function removeList(id: string): boolean {
    if (lists.value.length <= 1) return false
    for (const item of items.value.filter((entry) => entry.list_id === id)) {
      removeLocalEntity('todo_item', item.id)
    }
    items.value = items.value.filter((item) => item.list_id !== id)
    lists.value = lists.value.filter((list) => list.id !== id)
    removeLocalEntity('todo_list', id)
    if (selectedListId.value === id) selectList(null)
    if (selectedItem.value == null) setDetailOpen(false)
    return true
  }

  function addItem(title: string, listId?: string): TodoItem | null {
    const clean = title.trim()
    const target = listId ?? selectedList.value?.id ?? defaultList.value?.id
    if (!clean || !target) return null
    const stamp = now()
    const item: TodoItem = {
      id: newId(),
      list_id: target,
      title: clean,
      notes: null,
      status: 'active',
      is_important: false,
      due_date: null,
      due_time: null,
      recurrence: null,
      completed_at: null,
      sort_order: 0,
      steps: [],
      created_at: stamp,
      updated_at: stamp,
    }
    items.value = [...items.value, item]
    saveItem(item)
    return item
  }

  function patchItem(id: string, patch: Partial<Pick<TodoItem, 'title' | 'notes' | 'is_important' | 'due_date' | 'due_time' | 'recurrence' | 'list_id'>>) {
    const item = items.value.find((entry) => entry.id === id)
    if (!item) return
    if (patch.title !== undefined) {
      const clean = patch.title.trim()
      if (!clean) return
      item.title = clean
    }
    if (patch.notes !== undefined) item.notes = patch.notes?.trim() || null
    if (patch.is_important !== undefined) item.is_important = patch.is_important
    if (patch.due_date !== undefined) {
      item.due_date = patch.due_date?.trim() || null
      if (!item.due_date) item.due_time = null
    }
    if (patch.due_time !== undefined && item.due_date) {
      item.due_time = patch.due_time?.trim().slice(0, 5) || null
    }
    if (patch.recurrence !== undefined) item.recurrence = patch.recurrence
    if (patch.list_id && lists.value.some((list) => list.id === patch.list_id)) {
      item.list_id = patch.list_id
    }
    item.updated_at = now()
    saveItem(item)
  }

  function setCompleted(id: string, completed: boolean) {
    const item = items.value.find((entry) => entry.id === id)
    if (!item) return
    const wasActive = item.status === 'active'
    item.status = completed ? 'completed' : 'active'
    item.completed_at = completed ? now() : null
    item.updated_at = now()
    saveItem(item)
    // A repeating task comes back for its next day once this one is done.
    if (completed && wasActive && item.recurrence && item.due_date) {
      const stamp = now()
      const next: TodoItem = {
        ...item,
        id: newId(),
        status: 'active',
        completed_at: null,
        due_date: nextDueDate(item.due_date, item.recurrence),
        steps: item.steps.map((step) => ({ ...step, id: newId(), is_completed: false })),
        created_at: stamp,
        updated_at: stamp,
      }
      items.value = [...items.value, next]
      saveItem(next)
    }
  }

  function toggleImportant(id: string) {
    const item = items.value.find((entry) => entry.id === id)
    if (item) patchItem(id, { is_important: !item.is_important })
  }

  function removeItems(ids: string[]): number {
    const gone = new Set(ids)
    const before = items.value.length
    items.value = items.value.filter((item) => !gone.has(item.id))
    for (const id of gone) removeLocalEntity('todo_item', id)
    if (selectedItemId.value && gone.has(selectedItemId.value)) setDetailOpen(false)
    return before - items.value.length
  }

  function removeItem(id: string) {
    removeItems([id])
  }

  function addStep(itemId: string, title: string) {
    const item = items.value.find((entry) => entry.id === itemId)
    const clean = title.trim()
    if (!item || !clean) return
    item.steps = [
      ...item.steps,
      { id: newId(), title: clean, is_completed: false, sort_order: item.steps.length },
    ]
    item.updated_at = now()
    saveItem(item)
  }

  function toggleStep(itemId: string, stepId: string) {
    const item = items.value.find((entry) => entry.id === itemId)
    const step = item?.steps.find((entry) => entry.id === stepId)
    if (!item || !step) return
    step.is_completed = !step.is_completed
    item.updated_at = now()
    saveItem(item)
  }

  function removeStep(itemId: string, stepId: string) {
    const item = items.value.find((entry) => entry.id === itemId)
    if (!item) return
    item.steps = item.steps.filter((step) => step.id !== stepId)
    item.updated_at = now()
    saveItem(item)
  }

  return {
    lists,
    items,
    loaded,
    sortedLists,
    selectedListId,
    selectedList,
    selectedItemId,
    selectedItem,
    detailOpen,
    sortBy,
    showCompleted,
    sortedItems,
    completedItemIds,
    activeTitle,
    totalOpen,
    defaultList,
    openCount,
    load,
    selectList,
    selectItem,
    setDetailOpen,
    setSortBy,
    setShowCompleted,
    toggleImportant,
    removeItems,
    addList,
    renameList,
    removeList,
    addItem,
    patchItem,
    setCompleted,
    removeItem,
    addStep,
    toggleStep,
    removeStep,
  }
})
