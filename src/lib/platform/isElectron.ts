/** True when the app is running inside the Electron shell (preload injected). */
export const isElectron =
  typeof window !== 'undefined' && Boolean(window.veennaElectron?.isElectron)

/** True in the dedicated always-on-top dictation HUD window. */
export const isDictationHudWindow =
  typeof window !== 'undefined' && Boolean(window.veennaElectron?.isDictationHud)

/** The Electron main window (not the floating HUD). */
export const isElectronMainWindow = isElectron && !isDictationHudWindow

/** Hidden-inset traffic lights + drag spacer: macOS only. Windows and Linux use a native title bar. */
export const isElectronMacMainWindow =
  isElectronMainWindow &&
  typeof window !== 'undefined' &&
  window.veennaElectron?.platform === 'darwin'

export function getVeennaElectron() {
  if (!isElectron) return undefined
  return window.veennaElectron
}
