import { getVeennaElectron, isElectron } from '@/lib/platform/isElectron'
import type { VeennaPermissionStatus } from '@/types/electron'

type MicPermissionStatus = Extract<
  VeennaPermissionStatus,
  'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown' | 'unsupported'
>

export type MicrophonePermissionRecovery = {
  /** True when microphone access is missing or blocked. */
  needsPermission: boolean
  /** Status after any prompt / settings open we attempted. */
  status: MicPermissionStatus
  /** Raised the macOS / browser ask prompt. */
  prompted: boolean
  /** Opened System Settings because macOS will not ask again. */
  openedSettings: boolean
  /** Copy to show on the HUD instead of a generic transcription failure. */
  message: string
}

const MIC_DENIED_MESSAGE =
  'Microphone access is required. Allow Microphone for veenna, then try again.'
const MIC_SETTINGS_MESSAGE =
  'Microphone is blocked. Turn it on in System Settings → Privacy & Security → Microphone, then try again.'

function errorName(err: unknown): string {
  if (!err || typeof err !== 'object') return ''
  return String((err as { name?: string }).name || '')
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || ''
  if (typeof err === 'string') return err
  if (!err || typeof err !== 'object') return ''
  return String((err as { message?: string }).message || '')
}

/** True when the thrown error itself is a mic / media permission denial. */
export function isMicPermissionError(err: unknown): boolean {
  const name = errorName(err)
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return true
  }
  if (
    err &&
    typeof err === 'object' &&
    'failure' in err &&
    (err as { failure?: string }).failure === 'mic_denied'
  ) {
    return true
  }
  const message = errorMessage(err).toLowerCase()
  if (!message) return false
  return (
    (/\b(permission|notallowed|access)\b/.test(message) &&
      /\b(mic|microphone|media|denied|blocked|dismissed)\b/.test(message)) ||
    /microphone access (was |is )?denied|allow microphone|system settings.*microphone/i.test(
      message,
    )
  )
}

async function readBrowserMicPermission(): Promise<MicPermissionStatus> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown'
  try {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    if (result.state === 'granted') return 'granted'
    if (result.state === 'denied') return 'denied'
    if (result.state === 'prompt') return 'not-determined'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

async function readMicPermissionStatus(): Promise<MicPermissionStatus> {
  if (isElectron) {
    const api = getVeennaElectron()
    if (api?.listSystemPermissions) {
      try {
        const list = await api.listSystemPermissions()
        const mic = list?.permissions?.find((row) => row.id === 'microphone')
        if (mic?.status) return mic.status
      } catch {
        /* fall through */
      }
    }
  }
  return readBrowserMicPermission()
}

/**
 * Ask for Microphone when the OS will still prompt; otherwise open the
 * System Settings pane so the user can turn it on by hand.
 */
async function promptMicrophoneAccess(
  statusHint?: MicPermissionStatus,
): Promise<MicrophonePermissionRecovery> {
  const before =
    statusHint && statusHint !== 'unknown' ? statusHint : await readMicPermissionStatus()

  if (before === 'granted') {
    return {
      needsPermission: false,
      status: 'granted',
      prompted: false,
      openedSettings: false,
      message: '',
    }
  }

  if (isElectron) {
    const api = getVeennaElectron()
    let prompted = false
    let openedSettings = false
    // Annotated, not inferred: the early return above narrows `before` to
    // exclude 'granted', so an inferred `status` could never be assigned the
    // result of a prompt that succeeded, nor compared against 'granted' below.
    let status: MicPermissionStatus = before

    try {
      if (before === 'not-determined' && api?.requestSystemPermission) {
        const result = await api.requestSystemPermission('microphone')
        prompted = true
        if (result?.status) status = result.status
      } else if (api?.openSystemPermissionSettings) {
        await api.openSystemPermissionSettings('microphone')
        openedSettings = true
        status = (await readMicPermissionStatus()) || before
      } else if (api?.requestSystemPermission) {
        const result = await api.requestSystemPermission('microphone')
        prompted = true
        if (result?.status) status = result.status
        if (result?.status && result.status !== 'granted' && api.openSystemPermissionSettings) {
          await api.openSystemPermissionSettings('microphone')
          openedSettings = true
        }
      }
    } catch {
      /* still return guidance below */
      status = await readMicPermissionStatus()
    }

    const granted = status === 'granted'
    return {
      needsPermission: !granted,
      status,
      prompted,
      openedSettings,
      message:
        openedSettings || status === 'denied' || status === 'restricted'
          ? MIC_SETTINGS_MESSAGE
          : MIC_DENIED_MESSAGE,
    }
  }

  // Browser: getUserMedia is the only way to raise the site permission prompt.
  if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      return {
        needsPermission: false,
        status: 'granted',
        prompted: true,
        openedSettings: false,
        message: '',
      }
    } catch (err) {
      const status = isMicPermissionError(err) ? 'denied' : await readBrowserMicPermission()
      return {
        needsPermission: true,
        status: status === 'granted' ? 'denied' : status,
        prompted: true,
        openedSettings: false,
        message: MIC_DENIED_MESSAGE,
      }
    }
  }

  return {
    needsPermission: true,
    status: before,
    prompted: false,
    openedSettings: false,
    message: MIC_DENIED_MESSAGE,
  }
}

/**
 * If this failure is (or looks like) a microphone permission problem, raise
 * the OS / browser prompt and return HUD copy. Otherwise return null so the
 * caller can keep its normal error message.
 */
export async function recoverDictationMicPermission(
  err?: unknown,
): Promise<MicrophonePermissionRecovery | null> {
  const status = await readMicPermissionStatus()
  const errorLooksLikePermission = err != null && isMicPermissionError(err)
  const statusBlocksMic =
    status === 'denied' || status === 'not-determined' || status === 'restricted'

  if (!errorLooksLikePermission && !statusBlocksMic) return null

  return promptMicrophoneAccess(status)
}
