/**
 * Electron IPC uses structured clone. Vue reactive proxies (and other host objects)
 * throw "An object could not be cloned".
 *
 * Returns a plain JSON-safe value, or `null` when the value cannot be serialized
 * (never return the original - that can still fail IPC cloning).
 */
export function toPlainIpcValue<T>(value: T): T | null {
  if (value == null) return value
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    return null
  }
}
