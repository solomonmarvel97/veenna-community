import { describe, expect, it } from 'vitest'
import {
  DEFAULT_HUD_APPEARANCE,
  normalizeHudAppearance,
  readHudAppearance,
} from '@/lib/voice/voiceHudAppearance'

describe('voiceHudAppearance', () => {
  it('normalizes invalid values to defaults', () => {
    expect(
      normalizeHudAppearance({
        surface: 'unknown' as never,
        reduceMotion: true,
      }),
    ).toEqual({
      ...DEFAULT_HUD_APPEARANCE,
      reduceMotion: true,
    })
  })

  it('reads defaults when storage is empty', () => {
    expect(readHudAppearance()).toEqual({
      surface: 'obsidian',
      reduceMotion: true,
    })
  })
})
