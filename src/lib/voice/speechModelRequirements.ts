import type { LocalSpeechModelDef, LocalSpeechModelRuntime } from '@/lib/voice/localWhisperModels'
import { speechModelRuntime, speechModelRuntimeLabel } from '@/lib/voice/localWhisperModels'
import type { HuggingFaceModelSpec } from '@/lib/voice/huggingfaceModelSpec'
import { isElectron } from '@/lib/platform/isElectron'

export type SpeechMachineInfo = {
  platform: NodeJS.Platform
  arch: string
  osVersion: string
  cpuModel: string
  cpuCores: number
  totalMemMb: number
  freeMemMb: number
  freeDiskMb: number | null
  pythonVersion: string | null
  isElectron: boolean
  isPackaged: boolean
}

type SpeechRuntimeCapability = {
  supportedOnPlatform: boolean
  ready: boolean
  blockReason: string | null
  setupSteps: string[]
}

export type SpeechCapabilitiesSnapshot = {
  machine: SpeechMachineInfo
  runtimes: Record<LocalSpeechModelRuntime, SpeechRuntimeCapability>
  checkedAt: string
}

type SpeechCompatibilityIssue = {
  code: string
  title: string
  detail: string
}

export type SpeechModelRequirements = {
  minRamMb: number
  minFreeDiskMb: number
  recommendedRamMb: number
  downloadMb: number
  source: 'huggingface' | 'catalog_estimate'
}

export type SpeechModelCompatibilityResult = {
  ok: boolean
  runtime: LocalSpeechModelRuntime
  issues: SpeechCompatibilityIssue[]
  setupSteps: string[]
  requirements: SpeechModelRequirements
}

const RUNTIME_RAM_OVERHEAD_MB: Record<LocalSpeechModelRuntime, number> = {
  'onnx-transformers-js': 0,
  'onnx-node': 512,
  'whisper-cpp': 256,
  nemo: 2048,
  'pytorch-hf': 1536,
  'mlx-gguf': 1024,
}

const RUNTIME_BLOCK_LABELS: Record<string, string> = {
  runtime_not_bundled: 'Runtime not bundled in veenna yet',
  unsupported_platform: 'Not supported on this operating system',
  unsupported_architecture: 'Not supported on this CPU architecture',
}

function parseSizeLabelMb(sizeLabel: string): number {
  const match = sizeLabel.match(/([\d.]+)\s*(GB|MB)/i)
  if (!match) return 512
  const value = Number(match[1])
  if (!Number.isFinite(value)) return 512
  return match[2].toUpperCase() === 'GB' ? Math.round(value * 1024) : Math.round(value)
}

function ramFromDownloadMb(downloadMb: number, runtime: LocalSpeechModelRuntime) {
  const overhead = RUNTIME_RAM_OVERHEAD_MB[runtime]
  const minRamMb = Math.max(1024, Math.ceil(downloadMb * 2) + Math.round(overhead * 0.25))
  const recommendedRamMb = Math.max(2048, Math.ceil(downloadMb * 3) + Math.round(overhead * 0.5))
  return { minRamMb, recommendedRamMb }
}

export function speechModelRequirements(
  model: Pick<LocalSpeechModelDef, 'id' | 'tier' | 'sizeLabel' | 'runtime' | 'localAvailable'>,
  hfSpec?: HuggingFaceModelSpec | null,
): SpeechModelRequirements {
  const runtime = speechModelRuntime(model)
  const downloadMb =
    hfSpec && hfSpec.downloadBytes > 0 ? hfSpec.downloadMb : parseSizeLabelMb(model.sizeLabel)
  const { minRamMb, recommendedRamMb } = ramFromDownloadMb(downloadMb, runtime)

  return {
    minRamMb,
    recommendedRamMb,
    minFreeDiskMb: Math.max(128, Math.round(downloadMb * 1.1)),
    downloadMb,
    source: hfSpec && hfSpec.downloadBytes > 0 ? 'huggingface' : 'catalog_estimate',
  }
}

export function formatMegabytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${Math.round(mb)} MB`
}

export function checkSpeechModelCompatibility(
  model: LocalSpeechModelDef,
  capabilities: SpeechCapabilitiesSnapshot | null,
  hfSpec?: HuggingFaceModelSpec | null,
  options?: { capabilitiesError?: string | null; inDesktopApp?: boolean },
): SpeechModelCompatibilityResult {
  const runtime = speechModelRuntime(model)
  const requirements = speechModelRequirements(model, hfSpec)
  const issues: SpeechCompatibilityIssue[] = []
  const setupSteps: string[] = []
  const inDesktopApp = options?.inDesktopApp ?? isElectron

  if (model.localAvailable === false) {
    issues.push({
      code: 'catalog_unavailable',
      title: 'Not available for on-device download yet',
      detail: model.description,
    })
  }

  if (!capabilities) {
    const capabilitiesError = options?.capabilitiesError ?? null
    const ipcMissing =
      capabilitiesError?.includes('No handler registered') ||
      capabilitiesError?.includes('veenna:speech-capabilities')

    issues.push({
      code: 'capabilities_unknown',
      title: inDesktopApp ? 'Could not read this device' : 'Desktop device check unavailable',
      detail: !inDesktopApp
        ? 'Local speech model setup is only available in the veenna desktop app.'
        : ipcMissing
          ? 'Restart the veenna desktop app so device checks can load (quit fully, then open again).'
          : capabilitiesError
            ? `Machine details could not be loaded (${capabilitiesError}).`
            : 'Machine details are still loading. Try again in a moment.',
    })
    return { ok: false, runtime, issues, setupSteps, requirements }
  }

  const machine = capabilities.machine
  const runtimeCap = capabilities.runtimes[runtime]

  setupSteps.push(...(runtimeCap?.setupSteps ?? []))

  if (runtimeCap && !runtimeCap.supportedOnPlatform) {
    issues.push({
      code: 'runtime_platform',
      title: RUNTIME_BLOCK_LABELS.unsupported_platform,
      detail: `${speechModelRuntimeLabel(model)} does not run on ${machine.osVersion} (${machine.arch}).`,
    })
  }

  if (runtimeCap && !runtimeCap.ready) {
    issues.push({
      code: runtimeCap.blockReason || 'runtime_not_ready',
      title: RUNTIME_BLOCK_LABELS[runtimeCap.blockReason || ''] || 'Runtime setup required',
      detail: `${speechModelRuntimeLabel(model)} is not ready on this device yet.`,
    })
  }

  if (machine.totalMemMb < requirements.minRamMb) {
    issues.push({
      code: 'insufficient_ram',
      title: 'Not enough memory',
      detail: `Needs at least ${formatMegabytes(requirements.minRamMb)} RAM (this device has ${formatMegabytes(machine.totalMemMb)}).`,
    })
  } else if (machine.totalMemMb < requirements.recommendedRamMb) {
    issues.push({
      code: 'low_ram',
      title: 'Memory may be tight',
      detail: `Recommended ${formatMegabytes(requirements.recommendedRamMb)} RAM for smooth dictation (this device has ${formatMegabytes(machine.totalMemMb)}).`,
    })
  }

  if (machine.freeDiskMb != null && machine.freeDiskMb < requirements.minFreeDiskMb) {
    issues.push({
      code: 'insufficient_disk',
      title: 'Not enough free disk space',
      detail: `Needs ~${formatMegabytes(requirements.minFreeDiskMb)} free for download (about ${formatMegabytes(machine.freeDiskMb)} available).`,
    })
  }

  const hardBlockCodes = new Set([
    'catalog_unavailable',
    'capabilities_unknown',
    'runtime_platform',
    'runtime_not_bundled',
    'runtime_not_ready',
    'unsupported_architecture',
    'insufficient_ram',
    'insufficient_disk',
  ])

  const ok = !issues.some((issue) => hardBlockCodes.has(issue.code))
  return { ok, runtime, issues, setupSteps: [...new Set(setupSteps)], requirements }
}

export function machineSummaryLabel(machine: SpeechMachineInfo): string {
  return `${machine.osVersion} · ${machine.cpuCores} cores · ${formatMegabytes(machine.totalMemMb)} RAM`
}
