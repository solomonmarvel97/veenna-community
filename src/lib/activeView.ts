import type { ActiveView } from '@/types/veenna'

export type ThemeMode = 'light' | 'dark' | 'system'
const SMART_VIEWS = ['gmail-starred', 'tasks'] as const
/** Removed views (All, Important, History, Planned, My Day) all land on Veenna. */
const LEGACY_SMART_VIEWS: Record<string, (typeof SMART_VIEWS)[number]> = {
  'flagged-email': 'gmail-starred',
  all: 'tasks',
  important: 'tasks',
  completed: 'tasks',
  history: 'tasks',
  planned: 'tasks',
  'my-day': 'tasks',
}
