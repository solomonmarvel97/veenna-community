import { isElectron } from '@/lib/platform/isElectron'

export type CaptureChannel = 'web' | 'desktop' | 'mobile'

const CHANNELS: CaptureChannel[] = ['web', 'desktop', 'mobile']

const CHANNEL_LABELS: Record<CaptureChannel, string> = {
  web: 'Web',
  desktop: 'Desktop app',
  mobile: 'Mobile',
}

/** Which Veenna surface this client is: the desktop app, a phone, or the website. */
export function detectCaptureChannel(): CaptureChannel {
  if (isElectron) return 'desktop'
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent || ''
  if (ua.includes('Android') || ua.includes('iPhone') || ua.includes('iPad')) return 'mobile'
  return 'web'
}

export function normalizeCaptureChannel(value: unknown): CaptureChannel | null {
  return CHANNELS.find((channel) => channel === value) ?? null
}

export function captureChannelLabel(channel: CaptureChannel | null | undefined): string {
  return channel ? CHANNEL_LABELS[channel] : 'another device'
}
