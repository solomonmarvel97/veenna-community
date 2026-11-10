const STORAGE_KEY = 'veenna-device-id'

/** Stable per-install id used to ignore our own WS sync echoes. */
export function getVeennaDeviceId(): string {
  try {
    let id = localStorage.getItem(STORAGE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(STORAGE_KEY, id)
    }
    return id
  } catch {
    return 'anonymous'
  }
}
