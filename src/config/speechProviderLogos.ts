/** Static provider marks served from `public/speech-providers/`. */
const SPEECH_PROVIDER_LOGOS: Record<string, string> = {
  OpenAI: '/speech-providers/openai.svg',
  Meta: '/speech-providers/meta.svg',
  Microsoft: '/speech-providers/microsoft.svg',
  NbAiLab: '/speech-providers/nbailab.png',
  'Distil-Whisper': '/speech-providers/distil-whisper.svg',
  Moonshine: '/speech-providers/moonshine.png',
  'ONNX Community': '/speech-providers/onnx.svg',
  NVIDIA: '/speech-providers/nvidia.svg',
  Cohere: '/speech-providers/cohere.svg',
  IBM: '/speech-providers/ibm.svg',
  Qwen: '/speech-providers/qwen.svg',
  Mistral: '/speech-providers/mistral.svg',
}

export function speechProviderLogoSrc(provider: string): string | null {
  return SPEECH_PROVIDER_LOGOS[provider] ?? null
}
