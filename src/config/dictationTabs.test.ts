import { describe, expect, it } from 'vitest'
import { DICTATION_TABS, isDictationPath } from '@/config/dictationTabs'
import { ROUTES } from '@/router/paths'

describe('dictationTabs', () => {
  it('is Dictation and Insights', () => {
    expect(DICTATION_TABS.map((tab) => tab.path)).toEqual([ROUTES.dictation, ROUTES.insights])
  })

  it('matches the hub pages and nothing else', () => {
    for (const tab of DICTATION_TABS) expect(isDictationPath(tab.path)).toBe(true)
    expect(isDictationPath(ROUTES.settings)).toBe(false)
  })
})
