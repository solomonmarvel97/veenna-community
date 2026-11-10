/** Shared mic RMS → HUD bar height mapping (waveform + speech gate). */

export const MIC_WAVE_IDLE_LEVEL = 0.14
export const MIC_SPEECH_RMS_GATE = 0.014
const MIN_PEAK_RMS = 0.022
const PEAK_DECAY = 0.985
const NOISE_FLOOR_RATE = 0.04

export type MicWaveNormalizer = {
  sample: (rms: number) => number
  reset: () => void
}

export function createMicWaveNormalizer(): MicWaveNormalizer {
  let peakRms = MIN_PEAK_RMS
  let noiseFloor = 0.012

  function reset() {
    peakRms = MIN_PEAK_RMS
    noiseFloor = 0.012
  }

  function sample(rms: number): number {
    if (rms < MIC_SPEECH_RMS_GATE) {
      noiseFloor = noiseFloor * (1 - NOISE_FLOOR_RATE) + rms * NOISE_FLOOR_RATE
      peakRms = Math.max(MIN_PEAK_RMS, peakRms * PEAK_DECAY)
      return MIC_WAVE_IDLE_LEVEL
    }

    if (rms > peakRms) {
      peakRms = rms
    } else {
      peakRms = Math.max(MIN_PEAK_RMS, peakRms * PEAK_DECAY)
    }

    const floor = Math.max(MIC_SPEECH_RMS_GATE, noiseFloor * 0.9)
    const range = Math.max(peakRms - floor, 0.008)
    const normalized = Math.min(1, (rms - floor) / range)
    if (normalized < 0.04) return MIC_WAVE_IDLE_LEVEL

    return MIC_WAVE_IDLE_LEVEL + Math.pow(normalized, 0.45) * (1 - MIC_WAVE_IDLE_LEVEL)
  }

  return { sample, reset }
}
