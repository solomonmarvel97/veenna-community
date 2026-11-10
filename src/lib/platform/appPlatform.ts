export type AppPlatformId = 'macos' | 'ios' | 'windows' | 'linux' | 'android' | 'other'

export type AppPlatformInfo = {
  id: AppPlatformId
  label: string
}

function electronPlatform(): string {
  if (typeof window === 'undefined') return ''
  return String(window.veennaElectron?.platform || '')
}

function navigatorHints(): { ua: string; platform: string } {
  if (typeof navigator === 'undefined') return { ua: '', platform: '' }
  return {
    ua: navigator.userAgent || '',
    platform: navigator.platform || '',
  }
}

/** OS this client is running on, for About / device badges. */
export function detectAppPlatform(): AppPlatformInfo {
  const electron = electronPlatform()
  if (electron === 'darwin') return { id: 'macos', label: 'macOS' }
  if (electron === 'win32') return { id: 'windows', label: 'Windows' }
  if (electron === 'linux') return { id: 'linux', label: 'Linux' }

  const { ua, platform } = navigatorHints()
  if (/Android/i.test(ua)) return { id: 'android', label: 'Android' }
  if (/iPhone|iPad|iPod/i.test(ua)) return { id: 'ios', label: 'iOS' }
  if (/Mac/i.test(ua) || /Mac/i.test(platform)) return { id: 'macos', label: 'macOS' }
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return { id: 'windows', label: 'Windows' }
  if (/Linux/i.test(ua) || /Linux/i.test(platform)) return { id: 'linux', label: 'Linux' }
  return { id: 'other', label: 'Desktop' }
}
