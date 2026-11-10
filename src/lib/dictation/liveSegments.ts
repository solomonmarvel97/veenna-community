/**
 * Transcribes a dictation while it is being spoken, so letting go of the key
 * only leaves the last few seconds to transcribe. A second recorder runs beside the
 * session's own and is cut at natural pauses; each cut is a whole audio file
 * that is transcribed on this device at once.
 *
 * The session's own recorder is never touched. Any segment that fails makes
 * `finish` return null and the full recording is transcribed the usual way, so
 * this can only ever make a dictation faster, not lose one. A recording too
 * short to have been cut also returns null: it takes that same path.
 */

/**
 * The shortest cut. Cutting sooner costs extra passes for no gain, and leaves
 * Whisper too little context.
 */
export const LIVE_SEGMENT_MIN_MS = 10_000
/** Cut here even mid-sentence, so one long breath is still transcribed as it goes. */
export const LIVE_SEGMENT_MAX_MS = 25_000
/** Quiet for this long counts as a pause: a safe place to cut between words. */
const PAUSE_MS = 300
const TICK_MS = 150
/** Past this a segment has failed, and the full recording takes over. */
const SEGMENT_TIMEOUT_MS = 20_000
/** A tail this short, with no speech heard in it, held nothing the last cut missed. */
const MIN_TAIL_MS = 400
/** The end of the last segment, handed to the next as context. */
const CONTEXT_CHARS = 100
/** Keeps the vocabulary in the room the API leaves beside the context (224 characters in all). */
const PROMPT_BASE_CHARS = 120

export type LiveSegmentRequest = {
  blob: Blob
  durationMs: number
  /** The owner's vocabulary. */
  prompt: string | undefined
  /**
   * How the previous segment ended. Sent apart from the vocabulary: it is the speaker's own
   * words, so the server must never read a segment that repeats them as a prompt echo.
   */
  context: string | undefined
  /** The mic monitor measured speech in this segment, so a short phrase in it is real. */
  heardSpeech: boolean
  signal: AbortSignal
}

export type LiveSegmentsOptions = {
  createRecorder: () => MediaRecorder
  timesliceMs: number
  /** Whether the mic heard speech in the last `ms`. */
  hadSpeechWithinMs: (ms: number) => boolean
  /** Total speech heard so far; a cut with none in it is dropped, not uploaded. */
  speechMs: () => number
  /**
   * Whether the monitor is really measuring. When it is not (a suspended audio context reads
   * zero), "no speech" means nothing, so no segment is dropped for it.
   */
  speechMeasured?: () => boolean
  basePrompt: () => string | undefined
  transcribe: (request: LiveSegmentRequest) => Promise<string>
  /**
   * The first segment's text, the moment it is ready, while the rest is still being said. It is
   * early, partial text: only for work that can start before the words are all in.
   */
  onFirstText?: (text: string) => void
}

export type LiveResult = {
  /** The whole text, or null when the full recording must be used. */
  text: string | null
  /** One entry per upload, for the trace: "10400ms audio in 5200ms". */
  timings: string[]
}

export type LiveSegments = {
  /** Ends the session. */
  finish: () => Promise<LiveResult>
  cancel: () => void
}

type Segment = {
  recorder: MediaRecorder
  chunks: Blob[]
  startedAt: number
  speechAtStart: number
}

/** The vocabulary, cut to leave room for the context beside it. */
export function liveVocabulary(base: string | undefined): string | undefined {
  return (base ?? '').trim().slice(0, PROMPT_BASE_CHARS) || undefined
}

/** How the last segment ended, for the next one to carry on from. */
export function liveContext(previousText: string): string | undefined {
  return previousText.trim().slice(-CONTEXT_CHARS) || undefined
}

function stopSegment(segment: Segment): Promise<Blob | null> {
  const { recorder, chunks } = segment
  const toBlob = () =>
    chunks.length ? new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type }) : null
  if (recorder.state === 'inactive') return Promise.resolve(toBlob())
  return new Promise((resolve) => {
    recorder.onstop = () => resolve(toBlob())
    try {
      recorder.stop()
    } catch {
      resolve(toBlob())
    }
  })
}

export function startLiveSegments(options: LiveSegmentsOptions): LiveSegments | null {
  const abort = new AbortController()
  const results: Promise<string | null>[] = []
  const timings: string[] = []
  let failed = false
  let lastText = ''
  let reportFailure: () => void = () => {}
  const failure = new Promise<null>((resolve) => {
    reportFailure = () => resolve(null)
  })
  let tick: ReturnType<typeof setInterval> | null = null

  function fail() {
    failed = true
    stopTicking()
    reportFailure()
  }

  function stopTicking() {
    if (tick) clearInterval(tick)
    tick = null
  }

  function open(): Segment | null {
    try {
      const recorder = options.createRecorder()
      const segment: Segment = {
        recorder,
        chunks: [],
        startedAt: Date.now(),
        speechAtStart: options.speechMs(),
      }
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) segment.chunks.push(event.data)
      }
      recorder.start(options.timesliceMs)
      return segment
    } catch {
      return null
    }
  }

  async function upload(
    blob: Blob,
    durationMs: number,
    order: number,
    heardSpeech: boolean,
  ): Promise<string | null> {
    const timeout = AbortSignal.timeout(SEGMENT_TIMEOUT_MS)
    const sentAt = Date.now()
    const slot = timings.push(`${durationMs}ms audio unfinished`) - 1
    try {
      const text = await options.transcribe({
        blob,
        durationMs,
        prompt: liveVocabulary(options.basePrompt()),
        context: liveContext(lastText),
        heardSpeech,
        signal: AbortSignal.any([abort.signal, timeout]),
      })
      if (text.trim()) lastText = text
      if (order === 0 && text.trim()) options.onFirstText?.(text.trim())
      timings[slot] = `${durationMs}ms audio in ${Date.now() - sentAt}ms`
      return text
    } catch {
      fail()
      return null
    }
  }

  /** Speech the monitor measured since the segment began. */
  function heardSpeechIn(segment: Segment): boolean {
    return options.speechMs() > segment.speechAtStart
  }

  /** The monitor reads real levels; without it a segment's silence can't be trusted. */
  function speechMeasured(): boolean {
    return options.speechMeasured?.() ?? true
  }

  /** Queues the segment's text in spoken order, however the uploads finish. */
  function close(segment: Segment, send: boolean, heardSpeech: boolean) {
    const durationMs = Date.now() - segment.startedAt
    const order = results.length
    results.push(
      stopSegment(segment).then((blob) => {
        if (!send || !blob || abort.signal.aborted) return ''
        return upload(blob, durationMs, order, heardSpeech)
      }),
    )
  }

  const first = open()
  if (!first) return null
  let current = first

  function cut() {
    // The next recorder starts first, so a word landing on the cut is in one of them.
    const next = open()
    if (!next) {
      fail()
      return
    }
    const closing = current
    current = next
    const heardSpeech = heardSpeechIn(closing)
    // Only a monitor that is really measuring can say a segment was silent.
    close(closing, heardSpeech || !speechMeasured(), heardSpeech)
  }

  tick = setInterval(() => {
    const age = Date.now() - current.startedAt
    if (age < LIVE_SEGMENT_MIN_MS) return
    const pausing = !options.hadSpeechWithinMs(PAUSE_MS)
    if (!pausing && age < LIVE_SEGMENT_MAX_MS) return
    cut()
  }, TICK_MS)

  return {
    async finish() {
      stopTicking()
      if (failed || !results.length) {
        void stopSegment(current)
        return { text: null, timings }
      }
      // The tail is the last thing said: it always goes up unless it is a sliver with no speech.
      const tailMs = Date.now() - current.startedAt
      const heardSpeech = heardSpeechIn(current)
      close(current, heardSpeech || tailMs >= MIN_TAIL_MS, heardSpeech)
      const texts = await Promise.race([Promise.all(results), failure])
      if (!texts || texts.some((text) => text === null)) return { text: null, timings }
      const joined = texts
        .map((text) => (text ?? '').trim())
        .filter(Boolean)
        .join(' ')
      return { text: joined || null, timings }
    },
    cancel() {
      stopTicking()
      abort.abort()
      void stopSegment(current)
    },
  }
}
