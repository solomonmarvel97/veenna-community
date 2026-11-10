import { format, isToday, isTomorrow, isYesterday, parseISO, subDays } from 'date-fns'
import type { TodoItem } from '@/stores/todos'

export type TodoDayGroup = {
  label: string
  dayKey: string
  items: TodoItem[]
}

/** The moment a task is filed under: when it was completed, when it is due, or when it last changed. */
export function todoListInstant(item: TodoItem): Date {
  if (item.status === 'completed') {
    return parseISO(item.completed_at ?? item.updated_at ?? item.created_at)
  }
  if (item.due_date) {
    const day = item.due_date.slice(0, 10)
    const time = item.due_time?.slice(0, 5) ?? '23:59'
    return parseISO(`${day}T${time}:00`)
  }
  return parseISO(item.updated_at ?? item.created_at)
}

function dayLabel(date: Date): string {
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  if (isTomorrow(date)) return 'Tomorrow'
  return format(date, 'EEEE, MMM d')
}

/**
 * Groups tasks by calendar day: Today, then Yesterday, then the newest day first. Tasks keep the
 * order they arrive in within a day, so the chosen sort still decides the rows.
 */
export function groupTodosByDay(items: TodoItem[]): TodoDayGroup[] {
  const groups = new Map<string, TodoDayGroup>()
  for (const item of items) {
    const instant = todoListInstant(item)
    const dayKey = format(instant, 'yyyy-MM-dd')
    const existing = groups.get(dayKey)
    if (existing) {
      existing.items.push(item)
    } else {
      groups.set(dayKey, { label: dayLabel(instant), dayKey, items: [item] })
    }
  }
  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const yesterdayKey = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const rank = (dayKey: string) => (dayKey === todayKey ? 0 : dayKey === yesterdayKey ? 1 : 2)
  return [...groups.values()].sort((a, b) => {
    const delta = rank(a.dayKey) - rank(b.dayKey)
    return delta !== 0 ? delta : b.dayKey.localeCompare(a.dayKey)
  })
}
