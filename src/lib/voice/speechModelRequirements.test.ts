import { describe, expect, it } from 'vitest'
import type { LocalSpeechModelDef } from '@/lib/voice/localWhisperModels'
import type { HuggingFaceModelSpec } from '@/lib/voice/huggingfaceModelSpec'
import {
  checkSpeechModelCompatibility,
  formatMegabytes,
  speechModelRequirements,
} from '@/lib/voice/speechModelRequirements'
import type { SpeechCapabilitiesSnapshot } from '@/lib/voice/speechModelRequirements'

const baseModel: LocalSpeechModelDef = {
  id: 'Xenova/whisper-small',
  label: 'Whisper Small',
  provider: 'OpenAI',
  family: 'whisper',
  tier: 'light',
  sizeLabel: '~500 MB',
  description: 'Small',
  bundled: false,
  huggingFaceUrl: 'https://huggingface.co/Xenova/whisper-small',
}

const whisperSmallHfSpec: HuggingFaceModelSpec = {
  modelId: 'Xenova/whisper-small',
  downloadBytes: 42 * 1024 * 1024,
  downloadMb: 42,
  matchedFiles: [{ path: 'onnx/encoder_model_quantized.onnx', bytes: 10 * 1024 * 1024 }],
  missingFiles: [],
  fetchedAt: new Date().toISOString(),
  source: 'huggingface',
}

const capableMachine: SpeechCapabilitiesSnapshot = {
  checkedAt: new Date().toISOString(),
  machine: {
    platform: 'darwin',
    arch: 'arm64',
    osVersion: 'macOS 15.0',
    cpuModel: 'Apple M2',
    cpuCores: 8,
    totalMemMb: 16384,
    freeMemMb: 8192,
    freeDiskMb: 50000,
    pythonVersion: '3.12.1',
    isElectron: true,
    isPackaged: false,
  },
  runtimes: {
    'onnx-transformers-js': {
      supportedOnPlatform: true,
      ready: true,
      blockReason: null,
      setupSteps: ['Bundled with veenna - no extra install needed.'],
    },
    'onnx-node': {
      supportedOnPlatform: true,
      ready: true,
      blockReason: null,
      setupSteps: ['Bundled with veenna - no extra install needed.'],
    },
    'whisper-cpp': {
      supportedOnPlatform: true,
      ready: true,
      blockReason: null,
      setupSteps: ['Bundled with veenna - runs on the GPU, no extra install needed.'],
    },
    nemo: {
      supportedOnPlatform: true,
      ready: false,
      blockReason: 'runtime_not_bundled',
      setupSteps: ['Install NeMo'],
    },
    'pytorch-hf': {
      supportedOnPlatform: true,
      ready: false,
      blockReason: 'runtime_not_bundled',
      setupSteps: ['Install PyTorch'],
    },
    'mlx-gguf': {
      supportedOnPlatform: true,
      ready: false,
      blockReason: 'runtime_not_bundled',
      setupSteps: ['Install MLX'],
    },
  },
}

describe('speechModelRequirements', () => {
  it('uses Hugging Face download size when available', () => {
    const req = speechModelRequirements(baseModel, whisperSmallHfSpec)
    expect(req.source).toBe('huggingface')
    expect(req.downloadMb).toBe(42)
    expect(req.minRamMb).toBeLessThan(2048)
    expect(req.minFreeDiskMb).toBeGreaterThanOrEqual(42)
    expect(formatMegabytes(1536)).toBe('1.5 GB')
  })

  it('falls back to catalog size label when HF spec is missing', () => {
    const req = speechModelRequirements(baseModel)
    expect(req.source).toBe('catalog_estimate')
    expect(req.minRamMb).toBeLessThan(4096)
  })

  it('allows ONNX models on capable hardware', () => {
    const result = checkSpeechModelCompatibility(baseModel, capableMachine, whisperSmallHfSpec)
    expect(result.ok).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('blocks coming-soon catalog models', () => {
    const result = checkSpeechModelCompatibility(
      {
        ...baseModel,
        localAvailable: false,
        runtime: 'nemo',
        tier: 'large',
        sizeLabel: '~5 GB',
      },
      capableMachine,
      {
        ...whisperSmallHfSpec,
        downloadMb: 5 * 1024,
        downloadBytes: 5 * 1024 * 1024 * 1024,
      },
    )
    expect(result.ok).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'catalog_unavailable')).toBe(true)
    expect(result.issues.some((issue) => issue.code === 'runtime_not_bundled')).toBe(true)
  })

  it('blocks when RAM is below minimum for large HF models', () => {
    const lowRamMachine: SpeechCapabilitiesSnapshot = {
      ...capableMachine,
      machine: { ...capableMachine.machine, totalMemMb: 2048 },
    }
    const result = checkSpeechModelCompatibility(
      { ...baseModel, tier: 'large', sizeLabel: '~3 GB' },
      lowRamMachine,
      {
        ...whisperSmallHfSpec,
        downloadMb: 3 * 1024,
        downloadBytes: 3 * 1024 * 1024 * 1024,
      },
    )
    expect(result.ok).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'insufficient_ram')).toBe(true)
  })
})
