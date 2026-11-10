import { describe, expect, it } from 'vitest'
import {
  TRAILING_MAX_MS,
  TRAILING_QUIET_MS,
  TRAILING_UNMEASURED_MS,
  waitForTrailingSpeech,
} from '@/lib/dictation/trailingSpeech'

/** A fake clock: speech last heard at `lastSpeechAt`, waits move time forward. */
function clock(lastSpeechAt: number) {
  let now = 0
  return {
    monitor: { hadSpeechWithinMs: (ms: number) => now - lastSpeechAt <= ms },
    wait: async (ms: number) => {
      now += ms
    },
    now: () => now,
  }
}

describe('waitForTrailingSpeech', () => {
  it('stops at once when the speaker had already gone quiet', async () => {
    const c = clock(-1000)
    expect(await waitForTrailingSpeech(c.monitor, { measured: true, wait: c.wait })).toBe(0)
  })

  it('keeps recording through the last word until a short quiet', async () => {
    const c = clock(-50)
    const held = await waitForTrailingSpeech(c.monitor, { measured: true, wait: c.wait })
    expect(held).toBeGreaterThanOrEqual(TRAILING_QUIET_MS - 50)
    expect(held).toBeLessThan(TRAILING_QUIET_MS)
  })

  it('never holds past the cap while speech goes on', async () => {
    const c = { monitor: { hadSpeechWithinMs: () => true }, wait: async () => {} }
    expect(await waitForTrailingSpeech(c.monitor, { measured: true, wait: c.wait })).toBe(
      TRAILING_MAX_MS,
    )
  })

  it('gives a fixed allowance when the monitor cannot measure', async () => {
    const c = clock(-1000)
    expect(await waitForTrailingSpeech(c.monitor, { measured: false, wait: c.wait })).toBe(
      TRAILING_UNMEASURED_MS,
    )
  })
})
