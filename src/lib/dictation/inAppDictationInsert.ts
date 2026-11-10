import { isElectronMainWindow, getVeennaElectron } from '@/lib/platform/isElectron'
import {
  ensureDictationInsertFocusTracking,
  applyInAppDictationInsert,
} from '@/lib/dictation/insertAtCursor'

/** Remember in-app carets and accept HUD dictation into the focused field. */
export function startInAppDictationInsertReceiver() {
  if (!isElectronMainWindow) return
  ensureDictationInsertFocusTracking()
  window.__veennaInsertDictationText = (text: string) => applyInAppDictationInsert(text).ok
  getVeennaElectron()?.onInsertTextInApp?.((text) => applyInAppDictationInsert(text))
}
