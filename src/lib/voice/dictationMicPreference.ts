const STORAGE_KEY = 'veenna-preferred-mic-device-id'

export function readPreferredMicDeviceId(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const value = localStorage.getItem(STORAGE_KEY)?.trim()
    return value || null
  } catch {
    return null
  }
}

export function writePreferredMicDeviceId(deviceId: string | null): void {
  try {
    if (deviceId?.trim()) localStorage.setItem(STORAGE_KEY, deviceId.trim())
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore quota errors */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('veenna-mic-preference-changed'))
  }
}

export function onPreferredMicDeviceChanged(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const listener = () => handler()
  window.addEventListener('veenna-mic-preference-changed', listener)
  return () => window.removeEventListener('veenna-mic-preference-changed', listener)
}
