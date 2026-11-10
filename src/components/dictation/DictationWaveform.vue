<template>
  <canvas
    ref="canvasRef"
    class="dictation-waveform block h-7 w-[min(100%,240px)] min-w-0 sm:h-8 sm:w-[min(100%,280px)]"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createMicWaveNormalizer, MIC_WAVE_IDLE_LEVEL } from '@/lib/dictation/dictationMicLevel'
import { fillWaveBar, waveBarGap, waveBarShape, waveBarWidth } from '@/lib/dictation/waveBarShape'

const props = withDefaults(
  defineProps<{
    active?: boolean
    audioTrack?: MediaStreamTrack | null
    animating?: boolean
    /**
     * External normalized amplitude (0–1). Used when the mic lives in another
     * window (Electron voice-chat overlay) and no local audioTrack is available.
     */
    level?: number | null
  }>(),
  {
    active: false,
    audioTrack: null,
    animating: false,
    level: null,
  },
)

/**
 * A voice-recorder waveform: thin capsule bars, newest sound entering on the
 * right and scrolling left, fading out at the left edge. Silence is a row of dots.
 */
const SAMPLE_INTERVAL_MS = 20
/** One new bar every this many ms; sets how fast the wave scrolls. */
const COLUMN_MS = 55
/** Loudness envelope: quick to rise with a syllable, gentler to fall away. */
const ENVELOPE_ATTACK_MS = 18
const ENVELOPE_RELEASE_MS = 90
/** Lift so normal speech reaches near the top on its peaks. */
const VOICE_GAIN = 1.15
const MAX_FRAME_MS = 1000 / 30
const IDLE_ALPHA = 0.38

const canvasRef = ref<HTMLCanvasElement | null>(null)
const normalizer = createMicWaveNormalizer()

let audioContext: AudioContext | null = null
let analyser: AnalyserNode | null = null
let source: MediaStreamAudioSourceNode | null = null
let timeDomainData: Uint8Array<ArrayBuffer> | null = null
let animationFrame: number | null = null
let lastSampleAt = 0
let lastFrameAt = 0
let analyserGeneration = 0
let resizeObserver: ResizeObserver | null = null
let reducedMotionQuery: MediaQueryList | null = null
let cssWidth = 0
let cssHeight = 0
let pixelRatio = 1

/** Latest voice energy above idle, 0–1 (what the envelope chases). */
let rawEnergy = 0
/** Smoothed voice energy, 0–1. */
let envelope = 0
/** Committed bars, newest first, each an activity 0–1. */
let columns: number[] = []
/** Loudest moment of the bar currently entering on the right. */
let livePeak = 0
/** How far (0–1 of a slot) the wave has scrolled since the last bar landed. */
let scrollPhase = 0

function prefersReducedMotion(): boolean {
  return reducedMotionQuery?.matches ?? false
}

function barMetrics() {
  const barWidth = waveBarWidth(cssHeight)
  const gap = waveBarGap(barWidth)
  return { barWidth, slot: barWidth + gap }
}

function columnCapacity(): number {
  if (cssWidth <= 0) return 0
  return Math.ceil(cssWidth / barMetrics().slot) + 2
}

function resizeCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  cssWidth = Math.max(1, Math.round(rect.width))
  cssHeight = Math.max(1, Math.round(rect.height))
  pixelRatio = Math.max(1, window.devicePixelRatio || 1)
  canvas.width = Math.max(1, Math.round(cssWidth * pixelRatio))
  canvas.height = Math.max(1, Math.round(cssHeight * pixelRatio))
  paint()
}

function resetLevelTracking() {
  normalizer.reset()
  rawEnergy = 0
  envelope = 0
  livePeak = 0
  scrollPhase = 0
  columns = []
}

function clampLevel(value: number): number {
  if (!Number.isFinite(value)) return MIC_WAVE_IDLE_LEVEL
  return Math.min(1, Math.max(0, value))
}

/** Current mic level, idle..1 - from the external level or the local analyser. */
function readLevel(): number {
  if (typeof props.level === 'number') return clampLevel(props.level)
  if (!analyser || !timeDomainData) return MIC_WAVE_IDLE_LEVEL

  analyser.getByteTimeDomainData(timeDomainData)
  let squareSum = 0
  for (const sample of timeDomainData) {
    const normalized = (sample - 128) / 128
    squareSum += normalized * normalized
  }
  return normalizer.sample(Math.sqrt(squareSum / timeDomainData.length))
}

/** Level (idle..1) → energy above idle (0..1). */
function toEnergy(level: number): number {
  return Math.max(0, Math.min(1, (level - MIC_WAVE_IDLE_LEVEL) / (1 - MIC_WAVE_IDLE_LEVEL)))
}

function updateEnvelope(dtMs: number) {
  const tau = rawEnergy > envelope ? ENVELOPE_ATTACK_MS : ENVELOPE_RELEASE_MS
  envelope += (rawEnergy - envelope) * (1 - Math.exp(-dtMs / tau))
}

function advanceScroll(dtMs: number) {
  livePeak = Math.max(livePeak, envelope)
  scrollPhase += dtMs / COLUMN_MS
  const capacity = columnCapacity()
  while (scrollPhase >= 1) {
    columns.unshift(livePeak)
    livePeak = envelope
    scrollPhase -= 1
  }
  if (columns.length > capacity) columns.length = capacity
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge1 <= edge0) return 1
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function drawBar(
  context: CanvasRenderingContext2D,
  x: number,
  value: number,
  barWidth: number,
  fadeWidth: number,
) {
  if (x + barWidth < 0 || x > cssWidth) return
  const activity = Math.min(1, value * VOICE_GAIN)
  const edgeFade =
    smoothstep(0, fadeWidth, x + barWidth / 2) *
    smoothstep(0, barWidth * 2, cssWidth - (x + barWidth / 2))
  context.globalAlpha = (IDLE_ALPHA + (1 - IDLE_ALPHA) * Math.min(1, activity * 4)) * edgeFade
  fillWaveBar(context, waveBarShape({ barWidth, canvasHeight: cssHeight, activity, x }))
}

function paint() {
  const canvas = canvasRef.value
  const context = canvas?.getContext('2d')
  if (!canvas || !context || cssWidth <= 0 || cssHeight <= 0) return

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  context.clearRect(0, 0, cssWidth, cssHeight)

  const style = getComputedStyle(canvas)
  context.fillStyle =
    style.getPropertyValue('--dictation-wave-color').trim() ||
    style.color ||
    'rgba(255, 255, 255, 0.92)'

  const { barWidth, slot } = barMetrics()
  const capacity = columnCapacity()

  if (prefersReducedMotion()) {
    // No scrolling: a still row of bars that rises and falls with the voice.
    const count = Math.max(1, Math.floor((cssWidth + slot - barWidth) / slot))
    const offsetX = (cssWidth - (count * slot - (slot - barWidth))) / 2
    const mid = Math.max(count - 1, 1) / 2
    for (let index = 0; index < count; index += 1) {
      const dist = Math.abs(index - mid) / mid
      const hill = 0.35 + 0.65 * Math.exp(-(dist * dist) / 0.3)
      drawBar(context, offsetX + index * slot, envelope * hill, barWidth, 0)
    }
    context.globalAlpha = 1
    return
  }

  const fadeWidth = Math.min(32, cssWidth * 0.22)
  const liveX = cssWidth - barWidth - scrollPhase * slot
  drawBar(context, liveX, Math.max(livePeak, envelope), barWidth, fadeWidth)
  for (let index = 0; index < capacity; index += 1) {
    drawBar(context, liveX - (index + 1) * slot, columns[index] ?? 0, barWidth, fadeWidth)
  }

  context.globalAlpha = 1
}

function tick(now: number) {
  if (!(props.active || props.animating)) return

  const dtMs = lastFrameAt ? Math.min(MAX_FRAME_MS, Math.max(0, now - lastFrameAt)) : 1000 / 60
  lastFrameAt = now

  if (now - lastSampleAt >= SAMPLE_INTERVAL_MS) {
    rawEnergy = props.active ? toEnergy(readLevel()) : 0
    lastSampleAt = now
  }

  updateEnvelope(dtMs)
  if (!prefersReducedMotion()) advanceScroll(dtMs)
  paint()

  animationFrame = requestAnimationFrame(tick)
}

function stopAnimation() {
  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame)
    animationFrame = null
  }
}

function setRunning(shouldRun: boolean) {
  stopAnimation()
  resetLevelTracking()
  if (!shouldRun) {
    paint()
    return
  }
  lastSampleAt = 0
  lastFrameAt = 0
  animationFrame = requestAnimationFrame(tick)
}

async function disconnectAudio() {
  source?.disconnect()
  analyser?.disconnect()
  source = null
  analyser = null
  timeDomainData = null
  if (audioContext) {
    const context = audioContext
    audioContext = null
    await context.close().catch(() => undefined)
  }
}

async function connectAnalyser(track: MediaStreamTrack | null) {
  const generation = ++analyserGeneration
  await disconnectAudio()
  if (generation !== analyserGeneration || !track || track.readyState === 'ended') return

  try {
    const AudioContextConstructor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextConstructor) return

    const context = new AudioContextConstructor()
    audioContext = context
    if (context.state === 'suspended') await context.resume()
    if (generation !== analyserGeneration || audioContext !== context) {
      await context.close().catch(() => undefined)
      return
    }
    source = context.createMediaStreamSource(new MediaStream([track]))
    analyser = context.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.18
    source.connect(analyser)
    timeDomainData = new Uint8Array(analyser.fftSize)
  } catch (error) {
    console.warn('[DictationWaveform] Audio analysis unavailable', error)
    if (generation === analyserGeneration) await disconnectAudio()
  }
}

watch(
  () => [props.audioTrack, typeof props.level === 'number'] as const,
  ([track, hasExternalLevel]) => {
    if (hasExternalLevel) {
      void disconnectAudio()
      return
    }
    void connectAnalyser(track)
  },
  { immediate: true },
)

watch(
  () => props.active || props.animating,
  (shouldRun) => setRunning(shouldRun),
  { immediate: true },
)

onMounted(() => {
  reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null
  const canvas = canvasRef.value
  if (!canvas) return
  resizeCanvas()
  resizeObserver = new ResizeObserver(() => {
    resizeCanvas()
  })
  resizeObserver.observe(canvas)
})

onBeforeUnmount(() => {
  analyserGeneration += 1
  stopAnimation()
  resizeObserver?.disconnect()
  resizeObserver = null
  void disconnectAudio()
})
</script>

<style scoped>
.dictation-waveform {
  --dictation-wave-color: rgba(255, 255, 255, 0.95);
  color: rgba(255, 255, 255, 0.95);
  background: transparent;
}
</style>
