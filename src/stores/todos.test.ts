import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const mirrored: Array<{ type: string; id: string; payload: Record<string, unknown> }> = []
const removed: Array<{ type: string; id: string }> = []

vi.mock('@/lib/localStore/localStoreClient', () => ({
  openLocalStore: vi.fn(async () => ({ ok: true })),
  listLocalEntities: vi.fn(async () => ({ ok: true, entities: [] })),
  mirrorLocalEntity: (type: string, id: string, payload: Record<string, unknown>) => {
    mirrored.push({ type, id, payload })
  },
  removeLocalEntity: (type: string, id: string) => {
    removed.push({ type, id })
  },
}))

import { useTodosStore } from '@/stores/todos'

describe('todos store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mirrored.length = 0
    removed.length = 0
  })

  it('starts with one default list and saves it', async () => {
    const store = useTodosStore()
    await store.load()
    expect(store.lists).toHaveLength(1)
    expect(store.lists[0]?.name).toBe('Tasks')
    expect(mirrored.some((row) => row.type === 'todo_list')).toBe(true)
  })

  it('adds, completes, stars and removes a task', async () => {
    const store = useTodosStore()
    await store.load()
    const item = store.addItem('  Buy milk  ')
    expect(item?.title).toBe('Buy milk')
    expect(store.addItem('   ')).toBeNull()
    store.setCompleted(item!.id, true)
    expect(store.items[0]?.status).toBe('completed')
    expect(store.items[0]?.completed_at).not.toBeNull()
    store.patchItem(item!.id, { is_important: true })
    expect(store.items[0]?.is_important).toBe(true)
    store.removeItem(item!.id)
    expect(store.items).toHaveLength(0)
    expect(removed).toContainEqual({ type: 'todo_item', id: item!.id })
  })

  it('keeps steps inside the task and saves the whole task', async () => {
    const store = useTodosStore()
    await store.load()
    const item = store.addItem('Plan trip')!
    store.addStep(item.id, 'Book flight')
    const step = store.items[0]!.steps[0]!
    store.toggleStep(item.id, step.id)
    const last = mirrored.filter((row) => row.id === item.id).at(-1)
    expect((last?.payload.steps as Array<{ is_completed: boolean }>)[0]?.is_completed).toBe(true)
  })

  it('removing a list removes its tasks, and the last list stays', async () => {
    const store = useTodosStore()
    await store.load()
    const first = store.lists[0]!
    expect(store.removeList(first.id)).toBe(false)
    const second = store.addList('Home')!
    store.addItem('Sweep', second.id)
    expect(store.removeList(second.id)).toBe(true)
    expect(store.items).toHaveLength(0)
    expect(store.lists).toHaveLength(1)
  })

  it('brings a repeating task back for its next day once it is completed', async () => {
    const store = useTodosStore()
    await store.load()
    const item = store.addItem('Water plants')!
    store.patchItem(item.id, { due_date: '2026-11-09', recurrence: { freq: 'DAILY', interval: 1 } })
    store.setCompleted(item.id, true)
    expect(store.items).toHaveLength(2)
    const next = store.items.find((entry) => entry.status === 'active')!
    expect(next.due_date).toBe('2026-11-10')
    expect(next.id).not.toBe(item.id)
  })

  it('skips the weekend for a weekdays task', async () => {
    const store = useTodosStore()
    await store.load()
    const item = store.addItem('Stand-up')!
    // 2026-11-13 is a Friday.
    store.patchItem(item.id, {
      due_date: '2026-11-13',
      recurrence: { freq: 'WEEKLY', interval: 1, by_weekday: [1, 2, 3, 4, 5] },
    })
    store.setCompleted(item.id, true)
    expect(store.items.find((entry) => entry.status === 'active')?.due_date).toBe('2026-11-16')
  })

  it('shows one list or all, hides completed on request, and sorts', async () => {
    const store = useTodosStore()
    await store.load()
    const home = store.addList('Home')!
    store.selectList(null)
    const a = store.addItem('b task')!
    store.addItem('a task', home.id)
    store.setCompleted(a.id, true)
    expect(store.sortedItems).toHaveLength(2)
    store.setShowCompleted(false)
    expect(store.sortedItems.map((i) => i.title)).toEqual(['a task'])
    store.setShowCompleted(true)
    store.setSortBy('alpha')
    expect(store.sortedItems.map((i) => i.title)).toEqual(['a task', 'b task'])
    store.selectList(home.id)
    expect(store.sortedItems.map((i) => i.title)).toEqual(['a task'])
    expect(store.activeTitle).toBe('Home')
  })

  it('removes several tasks at once and closes the detail pane when its task goes', async () => {
    const store = useTodosStore()
    await store.load()
    const a = store.addItem('one')!
    const b = store.addItem('two')!
    store.selectItem(a.id)
    expect(store.detailOpen).toBe(true)
    expect(store.removeItems([a.id, b.id])).toBe(2)
    expect(store.detailOpen).toBe(false)
  })
})
