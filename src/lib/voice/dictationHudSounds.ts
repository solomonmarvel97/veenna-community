export const DICTATION_HUD_SOUNDS_STORAGE_KEY = 'veenna-hud-sounds'

export type DictationHudSound = 'recordingStart' | 'processingStart' | 'success' | 'error'

type CachedClip = { buffer: AudioBuffer; delaySec: number }

let audioContext: AudioContext | null = null
let warmPromise: Promise<void> | null = null
const soundCache = new Map<DictationHudSound, CachedClip[]>()

/** Off until the owner turns HUD sounds on in Settings. */
export function areDictationHudSoundsEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    const raw = localStorage.getItem(DICTATION_HUD_SOUNDS_STORAGE_KEY)
    return raw === '1' || raw === 'true'
  } catch {
    /* private mode */
  }
  return false
}

export function writeDictationHudSoundsEnabled(enabled: boolean) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(DICTATION_HUD_SOUNDS_STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore quota */
  }
}

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  )
}

function getAudioContext(): AudioContext | null {
  const Ctor = getAudioContextCtor()
  if (!Ctor) return null
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new Ctor({ latencyHint: 'interactive' })
  }
  return audioContext
}

function waveSample(type: OscillatorType, phase: number): number {
  switch (type) {
    case 'square':
      return Math.sign(Math.sin(phase)) * 0.55
    case 'triangle': {
      const x = (phase / (2 * Math.PI)) % 1
      return 1 - 4 * Math.abs(Math.round(x - 0.25) - x)
    }
    case 'sine':
    default:
      return Math.sin(phase)
  }
}

function synthesizeToneBuffer(
  ctx: AudioContext,
  frequency: number,
  durationSec: number,
  {
    type = 'sine',
    volume = 0.06,
    attackSec = 0.002,
  }: {
    type?: OscillatorType
    volume?: number
    attackSec?: number
  } = {},
): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const totalSamples = Math.max(1, Math.ceil(sampleRate * (durationSec + 0.02)))
  const buffer = ctx.createBuffer(1, totalSamples, sampleRate)
  const data = buffer.getChannelData(0)
  const attackSamples = Math.max(1, Math.floor(sampleRate * attackSec))

  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / sampleRate
    let envelope = volume
    if (i < attackSamples) {
      envelope *= i / attackSamples
    } else {
      const decayT = (t - attackSec) / Math.max(durationSec, 0.001)
      envelope *= Math.exp(-5 * decayT)
    }
    data[i] = waveSample(type, 2 * Math.PI * frequency * t) * envelope
  }

  return buffer
}

function defineSound(
  ctx: AudioContext,
  sound: DictationHudSound,
  clips: Array<{
    frequency: number
    durationSec: number
    delaySec?: number
    type?: OscillatorType
    volume?: number
  }>,
) {
  soundCache.set(
    sound,
    clips.map(({ frequency, durationSec, delaySec = 0, type, volume }) => ({
      buffer: synthesizeToneBuffer(ctx, frequency, durationSec, { type, volume }),
      delaySec,
    })),
  )
}

function buildSoundCache(ctx: AudioContext) {
  soundCache.clear()
  defineSound(ctx, 'recordingStart', [
    { frequency: 740, durationSec: 0.05, volume: 0.06, type: 'sine' },
    { frequency: 988, durationSec: 0.06, delaySec: 0.028, volume: 0.048, type: 'sine' },
  ])
  defineSound(ctx, 'processingStart', [
    { frequency: 520, durationSec: 0.07, volume: 0.052, type: 'triangle' },
  ])
  defineSound(ctx, 'success', [
    { frequency: 660, durationSec: 0.06, volume: 0.052, type: 'sine' },
    { frequency: 880, durationSec: 0.08, delaySec: 0.04, volume: 0.044, type: 'sine' },
  ])
  defineSound(ctx, 'error', [
    { frequency: 260, durationSec: 0.07, volume: 0.055, type: 'square' },
    { frequency: 200, durationSec: 0.09, delaySec: 0.06, volume: 0.045, type: 'square' },
  ])
}

let resumePromise: Promise<void> | null = null

function ensureSoundCache(ctx: AudioContext) {
  if (soundCache.size === 0) buildSoundCache(ctx)
}

function ensureAudioRunning(ctx: AudioContext): Promise<void> {
  ensureSoundCache(ctx)
  if (ctx.state === 'running') return Promise.resolve()
  if (!resumePromise) {
    resumePromise = ctx.resume().finally(() => {
      resumePromise = null
    })
  }
  return resumePromise
}

/** Shared HUD AudioContext (resumed on hotkey via primeDictationHudSounds). */
export function getDictationHudAudioContext(): AudioContext | null {
  return getAudioContext()
}

/** Sync clip bake + kick AudioContext resume (safe to call on every hotkey down). */
export function primeDictationHudSounds() {
  const ctx = getAudioContext()
  if (!ctx) return
  ensureSoundCache(ctx)
  if (ctx.state === 'suspended') void ensureAudioRunning(ctx)
}

/** Create AudioContext + pre-render clips so playback is instant on hotkey. */
export function warmDictationHudSounds(): Promise<void> {
  if (warmPromise) return warmPromise
  warmPromise = (async () => {
    const ctx = getAudioContext()
    if (!ctx) return
    await ensureAudioRunning(ctx)
  })().catch(() => {
    warmPromise = null
  })
  return warmPromise
}

function scheduleCachedSound(sound: DictationHudSound, ctx: AudioContext) {
  const clips = soundCache.get(sound)
  if (!clips?.length) return

  const startAt = ctx.currentTime
  for (const clip of clips) {
    const source = ctx.createBufferSource()
    source.buffer = clip.buffer
    source.connect(ctx.destination)
    source.start(startAt + clip.delaySec)
  }
}

function playCachedSound(sound: DictationHudSound) {
  const ctx = getAudioContext()
  if (!ctx || !areDictationHudSoundsEnabled()) return

  if (soundCache.size === 0) {
    void warmDictationHudSounds().then(() => playCachedSound(sound))
    return
  }

  if (ctx.state === 'running') {
    scheduleCachedSound(sound, ctx)
    return
  }

  void ensureAudioRunning(ctx).then(() => {
    if (ctx.state === 'running') scheduleCachedSound(sound, ctx)
  })
}

/** Short UI feedback tones for dictation HUD state changes. */
export function playDictationHudSound(sound: DictationHudSound) {
  if (!areDictationHudSoundsEnabled()) return
  playCachedSound(sound)
}

/** Test helper - release shared AudioContext between tests. */
export function disposeDictationHudSoundsForTests() {
  soundCache.clear()
  warmPromise = null
  resumePromise = null
  if (!audioContext) return
  void audioContext.close()
  audioContext = null
}
