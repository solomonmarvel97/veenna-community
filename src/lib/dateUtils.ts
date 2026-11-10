import { format, isToday, isTomorrow, parseISO } from 'date-fns'

/** Local calendar date (YYYY-MM-DD) for due-date comparisons. */
export function localTodayDateStr(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Normalize API dates / Date objects / ISO timestamps to YYYY-MM-DD. */
export function isoDateKey(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  const raw = String(value ?? '').trim()
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (match) return match[1]
  return null
}




function parseDueDate(raw: string): Date | null {
  try {
    return parseISO(raw.length > 10 ? raw : `${raw}T12:00:00`)
  } catch {
    return null
  }
}

function formatShortDate(d: Date): string {
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  return format(d, 'MMM d')
}

function formatClockTime(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = String(raw).trim()
  const hhmm = trimmed.slice(0, 5)
  if (hhmm.length === 5 && hhmm[2] === ':') {
    return format(parseISO(`1970-01-01T${hhmm}:00`), 'h:mm a')
  }
  return trimmed
}

/** Due date/time when scheduled; otherwise created date/time for the list row. */
export function formatTaskScheduleLabel(item: {
  due_date?: string | null
  due_time?: string | null
  created_at?: string
}): string | null {
  if (item.due_date) {
    const d = parseDueDate(item.due_date)
    if (!d) return item.due_date.slice(0, 10)
    const datePart = formatShortDate(d)
    const timePart = formatClockTime(item.due_time)
    return timePart ? `${datePart} · ${timePart}` : datePart
  }
  if (item.created_at) {
    try {
      const d = parseISO(item.created_at)
      return `${formatShortDate(d)} · ${format(d, 'h:mm a')}`
    } catch {
      return null
    }
  }
  return null
}
