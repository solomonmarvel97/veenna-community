import { format, isToday, isYesterday, parseISO } from 'date-fns'
import type { VoiceCapture, VoiceCaptureGroup } from '@/stores/voiceCaptures'

function groupMeta(date: Date): Pick<VoiceCaptureGroup, 'label' | 'period'> {
  if (isToday(date)) return { label: 'Today', period: 'today' }
  if (isYesterday(date)) return { label: 'Yesterday', period: 'yesterday' }
  return { label: format(date, 'EEEE, MMMM d'), period: 'history' }
}

/** Group captures by calendar day for activity feed UI. */
export function groupCapturesByDate(items: VoiceCapture[]): VoiceCaptureGroup[] {
  const groups = new Map<string, VoiceCaptureGroup>()

  for (const item of items) {
    const meta = groupMeta(parseISO(item.createdAt))
    const existing = groups.get(meta.label)
    if (existing) {
      existing.items.push(item)
      continue
    }
    groups.set(meta.label, { ...meta, items: [item] })
  }

  return [...groups.values()].map((group) => ({
    ...group,
    items: group.items.sort(
      (a, b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime(),
    ),
  }))
}
