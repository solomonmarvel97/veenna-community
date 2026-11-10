import { MIC_SPEECH_RMS_GATE } from '@/lib/dictation/dictationMicLevel'

const MIN_NOISE_FLOOR = 0.008
/** Speech must clear the live floor. Keep close to the waveform gate so visible bars count. */
const SPEECH_OVER_FLOOR = 2.15
/**
 * While Veenna is talking, echo rejection is done downstream by comparing mic
 * level against live TTS playback level (shouldBargeInAssistantSpeech), which
 * discriminates far better than an absolute gate. Keep this gate close to the
 * normal one so real speech still registers as voiced frames.
 */
const BARGE_IN_OVER_FLOOR = 2.2
const BARGE_IN_MIN_RMS = 0.02

/**
 * Voiced-frame detector. Noise floor only learns from silence so talking
 * does not raise the gate and drop the rest of the utterance.
 */
export function createMicSpeechDetector() {
  let noiseFloor = MIN_NOISE_FLOOR
  let bargeIn = false

  function isSpeech(rms: number): boolean {
    const overFloor = bargeIn ? BARGE_IN_OVER_FLOOR : SPEECH_OVER_FLOOR
    const minGate = bargeIn ? Math.max(MIC_SPEECH_RMS_GATE, BARGE_IN_MIN_RMS) : MIC_SPEECH_RMS_GATE
    const speechGate = Math.max(minGate, noiseFloor * overFloor)
    const speaking = rms >= speechGate
    if (!speaking) {
      const next = Math.max(MIN_NOISE_FLOOR, noiseFloor * 0.96 + rms * 0.04)
      // While Veenna is talking the mic is dominated by speaker echo. Letting
      // that raise the floor ratchets the gate up until the user cannot break
      // in at all. Allow it to fall (a floor learned from the user's own speech
      // tail would otherwise stay high for the whole utterance), never rise.
      noiseFloor = bargeIn ? Math.min(noiseFloor, next) : next
    }
    return speaking
  }

  function setBargeIn(next: boolean) {
    bargeIn = Boolean(next)
  }

  function reset() {
    noiseFloor = MIN_NOISE_FLOOR
    bargeIn = false
  }

  return { isSpeech, setBargeIn, reset }
}
