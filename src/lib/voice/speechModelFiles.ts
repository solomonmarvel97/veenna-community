import manifest from './speechModelFiles.json'
import type { LocalSpeechModelDef } from '@/lib/voice/localWhisperModels'

const WHISPER_FILES = manifest.whisper
const CTC_FILES = manifest.ctc

export function getRequiredSpeechModelFiles(
  model: Pick<LocalSpeechModelDef, 'family'>,
): readonly string[] {
  return model.family === 'ctc' ? CTC_FILES : WHISPER_FILES
}
