/** Whisper ONNX models expect mono PCM at 16 kHz. */
export const WHISPER_SAMPLE_RATE = 16_000

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  )
}

function mixToMono(buffer: AudioBuffer): AudioBuffer {
  if (buffer.numberOfChannels === 1) return buffer
  const { length, sampleRate } = buffer
  const mono = new AudioBuffer({ length, numberOfChannels: 1, sampleRate })
  const out = mono.getChannelData(0)
  const channels = buffer.numberOfChannels
  for (let i = 0; i < length; i += 1) {
    let sum = 0
    for (let ch = 0; ch < channels; ch += 1) {
      sum += buffer.getChannelData(ch)[i] ?? 0
    }
    out[i] = sum / channels
  }
  return mono
}

async function resampleToWhisperRate(buffer: AudioBuffer): Promise<Float32Array> {
  const mono = mixToMono(buffer)
  if (mono.sampleRate === WHISPER_SAMPLE_RATE) {
    return mono.getChannelData(0).slice()
  }

  const frameCount = Math.max(1, Math.ceil(mono.duration * WHISPER_SAMPLE_RATE))
  const offline = new OfflineAudioContext(1, frameCount, WHISPER_SAMPLE_RATE)
  const source = offline.createBufferSource()
  source.buffer = mono
  source.connect(offline.destination)
  source.start(0)
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0).slice()
}

/** Decode a recorded speech blob into mono Float32 PCM for Whisper (16 kHz). */
export async function decodeSpeechBlobForWhisper(blob: Blob): Promise<Float32Array> {
  if (!blob?.size) return new Float32Array(0)

  const Ctor = getAudioContextCtor()
  if (!Ctor) {
    throw new Error(
      'AudioContext is not available in this environment. Cannot decode the recording for local speech recognition.',
    )
  }

  const context = new Ctor()
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const decoded = await context.decodeAudioData(arrayBuffer.slice(0))
    return resampleToWhisperRate(decoded)
  } finally {
    void context.close()
  }
}
