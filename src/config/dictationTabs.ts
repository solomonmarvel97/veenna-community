import type { Component } from 'vue'
import { PhMicrophone } from '@phosphor-icons/vue'
import ChartLineUpIcon from '@/components/icons/ChartLineUpIcon.vue'
import { ROUTES } from '@/router/paths'

export type DictationTab = {
  id: string
  label: string
  icon: Component
  /** Keep the regular icon when active; some icons read wrong filled. */
  outlineOnly?: boolean
  path: string
}

/** The tabs under the page header. */
export const DICTATION_TABS: DictationTab[] = [
  { id: 'dictation', label: 'Dictation', icon: PhMicrophone, path: ROUTES.dictation },
  {
    id: 'insights',
    label: 'Insights',
    icon: ChartLineUpIcon,
    outlineOnly: true,
    path: ROUTES.insights,
  },
]

export const DICTATION_DEFAULT_PATH = ROUTES.dictation

/** Is this path one of the Dictation hub's pages? */
export function isDictationPath(path: string): boolean {
  return DICTATION_TABS.some((tab) => path === tab.path || path.startsWith(`${tab.path}/`))
}
