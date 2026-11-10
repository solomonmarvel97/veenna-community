import { afterEach, describe, expect, it } from 'vitest'
import {
  DICTATION_HUD_SOUNDS_STORAGE_KEY,
  areDictationHudSoundsEnabled,
  disposeDictationHudSoundsForTests,
  warmDictationHudSounds,
  writeDictationHudSoundsEnabled,
} from '@/lib/voice/dictationHudSounds'

describe('dictationHudSounds', () => {
  afterEach(() => {
    localStorage.removeItem(DICTATION_HUD_SOUNDS_STORAGE_KEY)
    disposeDictationHudSoundsForTests()
  })

  it('is off until the owner turns it on', () => {
    expect(areDictationHudSoundsEnabled()).toBe(false)
  })

  it('persists the owner choice', () => {
    writeDictationHudSoundsEnabled(true)
    expect(areDictationHudSoundsEnabled()).toBe(true)
    writeDictationHudSoundsEnabled(false)
    expect(areDictationHudSoundsEnabled()).toBe(false)
  })

  it('warms audio cache without throwing', async () => {
    await expect(warmDictationHudSounds()).resolves.toBeUndefined()
  })
})
