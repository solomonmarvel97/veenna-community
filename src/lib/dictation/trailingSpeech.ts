/**
 * People let go of the dictation key on their last word, and that word is still on its way
 * through the audio pipeline (longer on Bluetooth) when the key comes up. Stopping the
 * recorders right then cuts it off. So when the mic was still hearing speech at release,
 * recording runs on until the speaker has been quiet briefly, within a small cap.
 * A release after the speaker already stopped costs nothing.
 */

/** Quiet this long after the last voiced frame: the last word has landed. */
export const TRAILING_QUIET_MS = 250
/** Never hold the recorders longer than this after release. */
export const TRAILING_MAX_MS = 700
/** A monitor that can't measure (suspended audio context) gets this fixed allowance. */
export const TRAILING_UNMEASURED_MS = 250
const POLL_MS = 30

export type TrailingSpeechMonitor = {
  hadSpeechWithinMs: (windowMs: number) => boolean
  sampledFrameCount?: () => number
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Resolves once the last words are in the recorders. Returns how long it held, for the trace. */
export async function waitForTrailingSpeech(
  monitor: TrailingSpeechMonitor | null,
  options: { measured: boolean; wait?: (ms: number) => Promise<void> },
): Promise<number> {
  const wait = options.wait ?? sleep
  if (!monitor) return 0
  if (!options.measured) {
    await wait(TRAILING_UNMEASURED_MS)
    return TRAILING_UNMEASURED_MS
  }
  let held = 0
  while (held < TRAILING_MAX_MS && monitor.hadSpeechWithinMs(TRAILING_QUIET_MS)) {
    const step = Math.min(POLL_MS, TRAILING_MAX_MS - held)
    await wait(step)
    held += step
  }
  return held
}
