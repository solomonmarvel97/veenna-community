import { describe, expect, it } from 'vitest'
import { ROUTES, isSettingsTab, normalizePath, settingsPath } from '@/router/paths'
import { parseSettingsTabQuery } from '@/router/query'

describe('router paths', () => {
  it('normalizes /home, trailing slashes and hashes', () => {
    expect(normalizePath('/home')).toBe(ROUTES.home)
    expect(normalizePath('/dictation/')).toBe(ROUTES.dictation)
    expect(normalizePath('/settings#top')).toBe(ROUTES.settings)
    expect(normalizePath('')).toBe(ROUTES.home)
  })

  it('knows the settings tabs, and calls speech-models the models tab', () => {
    expect(isSettingsTab('dictation')).toBe(true)
    expect(isSettingsTab('speech-models')).toBe(true)
    expect(isSettingsTab('agent')).toBe(false)
  })

  it('builds settings addresses; General needs no query', () => {
    expect(settingsPath()).toEqual({ path: '/settings' })
    expect(settingsPath('general')).toEqual({ path: '/settings' })
    expect(settingsPath('models')).toEqual({ path: '/settings', query: { tab: 'models' } })
  })
})

describe('router query', () => {
  it('parses settings tabs; anything unknown opens General', () => {
    expect(parseSettingsTabQuery({ tab: 'appearance' })).toBe('appearance')
    expect(parseSettingsTabQuery({ tab: 'speech-models' })).toBe('models')
    expect(parseSettingsTabQuery({ tab: 'agent' })).toBe('general')
    expect(parseSettingsTabQuery({})).toBe('general')
  })
})
