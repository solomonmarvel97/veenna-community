import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LIVE_SEGMENT_MAX_MS,
  LIVE_SEGMENT_MIN_MS,
  liveContext,
  liveVocabulary,
  startLiveSegments,
  type LiveSegmentRequest,
} from '@/lib/dictation/liveSegments'

class FakeRecorder {
  state = 'inactive'
  mimeType = 'audio/webm'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  start() {
    this.state = 'recording'
    this.ondataavailable?.({ data: new Blob(['audio']) })
  }
  stop() {
    this.state = 'inactive'
    this.onstop?.()
  }
}

function setup(
  transcribe: (request: LiveSegmentRequest, index: number) => Promise<string>,
  onFirstText?: (text: string) => void,
  measured = true,
) {
  const recorders: FakeRecorder[] = []
  const requests: LiveSegmentRequest[] = []
  const mic = { speaking: true, speech: 0 }
  const live = startLiveSegments({
    createRecorder: () => {
      const recorder = new FakeRecorder()
      recorders.push(recorder)
      return recorder as unknown as MediaRecorder
    },
    timesliceMs: 100,
    hadSpeechWithinMs: () => mic.speaking,
    speechMs: () => mic.speech,
    speechMeasured: () => measured,
    basePrompt: () => 'Veenna',
    onFirstText,
    transcribe: (request) => {
      requests.push(request)
      return transcribe(request, requests.length - 1)
    },
  })
  return { live: live!, mic, recorders, requests }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('startLiveSegments', () => {
  it('cuts at a pause once a segment is long enough, never sooner', async () => {
    const { mic, recorders, live } = setup(async () => 'one')
    mic.speaking = false
    mic.speech = 1000
    await vi.advanceTimersByTimeAsync(LIVE_SEGMENT_MIN_MS - 1000)
    expect(recorders).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1200)
    expect(recorders).toHaveLength(2)
    live.cancel()
  })

  it('does not cut while the speaker is mid-sentence, until the longest segment', async () => {
    const { mic, recorders, live } = setup(async () => 'one')
    mic.speech = 1000
    await vi.advanceTimersByTimeAsync(LIVE_SEGMENT_MAX_MS - 1000)
    expect(recorders).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1200)
    expect(recorders).toHaveLength(2)
    live.cancel()
  })

  it('joins the segments in spoken order, whichever upload finishes first', async () => {
    let releaseFirst = (_text: string) => {}
    const { mic, live } = setup((_request, index) =>
      index === 0
        ? new Promise((resolve) => {
            releaseFirst = resolve
          })
        : Promise.resolve('second part.'),
    )
    mic.speech = 1000
    mic.speaking = false
    await vi.advanceTimersByTimeAsync(LIVE_SEGMENT_MIN_MS + 200)
    mic.speech = 2000
    await vi.advanceTimersByTimeAsync(1000)
    const finished = live.finish()
    await vi.advanceTimersByTimeAsync(0)
    releaseFirst('First part.')
    await expect(finished).resolves.toMatchObject({
      text: 'First part. second part.',
      timings: [expect.stringContaining('ms audio in'), expect.stringContaining('ms audio in')],
    })
  })

  it('hands a recording too short to cut back to the normal path', async () => {
    const { live, requests } = setup(async () => 'one')
    await vi.advanceTimersByTimeAsync(3000)
    await expect(live.finish()).resolves.toMatchObject({ text: null })
    expect(requests).toHaveLength(0)
  })

  it('falls back to the full recording when any segment fails', async () => {
    const { mic, live } = setup((_request, index) =>
      index === 0 ? Promise.reject(new Error('network')) : Promise.resolve('tail'),
    )
    mic.speech = 1000
    mic.speaking = false
    await vi.advanceTimersByTimeAsync(LIVE_SEGMENT_MIN_MS + 200)
    await expect(live.finish()).resolves.toMatchObject({ text: null })
  })

  it('never uploads a segment with no speech in it', async () => {
    const { mic, live, requests } = setup(async () => 'tail')
    mic.speaking = false
    await vi.advanceTimersByTimeAsync(LIVE_SEGMENT_MIN_MS + 200)
    await vi.advanceTimersByTimeAsync(1000)
    await live.finish()
    expect(requests).toHaveLength(1)
  })

  it('gives each segment the end of the last one as context', async () => {
    const { mic, live, requests } = setup(async () => 'the first words')
    mic.speech = 1000
    mic.speaking = false
    await vi.advanceTimersByTimeAsync(LIVE_SEGMENT_MIN_MS + 200)
    await vi.advanceTimersByTimeAsync(1000)
    await live.finish()
    expect(requests[0]).toMatchObject({ prompt: 'Veenna', context: undefined })
    // The previous words travel apart from the vocabulary, so the server never reads a
    // last segment that repeats them as an echo of the prompt.
    expect(requests[1]).toMatchObject({ prompt: 'Veenna', context: 'the first words' })
  })

  it('always sends the last words, marked as heard when the mic measured speech', async () => {
    const { mic, live, requests } = setup(async (_request, index) =>
      index === 0 ? 'and then we send it to the team' : 'send it to the team',
    )
    mic.speech = 1000
    mic.speaking = false
    await vi.advanceTimersByTimeAsync(LIVE_SEGMENT_MIN_MS + 200)
    mic.speech = 1500
    await vi.advanceTimersByTimeAsync(800)
    await expect(live.finish()).resolves.toMatchObject({
      text: 'and then we send it to the team send it to the team',
    })
    expect(requests.map((request) => request.heardSpeech)).toEqual([true, true])
  })

  it('sends a very short tail when speech was heard in it', async () => {
    const { mic, live, requests } = setup(async (_request, index) =>
      index === 0 ? 'The plan is done.' : 'Thanks.',
    )
    mic.speech = 1000
    mic.speaking = false
    await vi.advanceTimersByTimeAsync(LIVE_SEGMENT_MIN_MS + 200)
    mic.speech = 1080
    await vi.advanceTimersByTimeAsync(150)
    await expect(live.finish()).resolves.toMatchObject({ text: 'The plan is done. Thanks.' })
    expect(requests).toHaveLength(2)
  })

  it('keeps every segment when the mic monitor is not measuring', async () => {
    const { mic, live, requests } = setup(async () => 'words', undefined, false)
    mic.speaking = false
    await vi.advanceTimersByTimeAsync(LIVE_SEGMENT_MIN_MS + 200)
    await vi.advanceTimersByTimeAsync(1000)
    await expect(live.finish()).resolves.toMatchObject({ text: 'words words' })
    expect(requests.map((request) => request.heardSpeech)).toEqual([false, false])
  })

  it('aborts uploads in flight on cancel', async () => {
    const { mic, live, requests } = setup(() => new Promise(() => {}))
    mic.speech = 1000
    mic.speaking = false
    await vi.advanceTimersByTimeAsync(LIVE_SEGMENT_MIN_MS + 200)
    live.cancel()
    expect(requests[0]?.signal.aborted).toBe(true)
  })
})

describe('live prompt parts', () => {
  it('stays within what the API keeps of a prompt', () => {
    const vocabulary = liveVocabulary('v'.repeat(500)) ?? ''
    const context = liveContext('w'.repeat(500)) ?? ''
    expect(vocabulary.length + 1 + context.length).toBeLessThanOrEqual(224)
  })

  it('is undefined with nothing to say', () => {
    expect(liveVocabulary(undefined)).toBeUndefined()
    expect(liveContext('  ')).toBeUndefined()
  })

  it('reports the first segment text once, as soon as it is ready, and never a later one', async () => {
    const heard: string[] = []
    const { mic, live } = setup(
      async (_request, index) => (index === 0 ? ' remind me to call Sam ' : 'and then more'),
      (text) => heard.push(text),
    )
    mic.speech = 1000
    mic.speaking = false
    await vi.advanceTimersByTimeAsync(LIVE_SEGMENT_MIN_MS + 200)
    expect(heard).toEqual(['remind me to call Sam'])
    mic.speech = 2000
    await vi.advanceTimersByTimeAsync(LIVE_SEGMENT_MIN_MS + 200)
    expect(heard).toEqual(['remind me to call Sam'])
    live.cancel()
  })
})
