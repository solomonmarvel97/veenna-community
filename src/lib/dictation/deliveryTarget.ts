import { dictationEngine, type DictationDeliverySnapshot } from '@/lib/dictation/dictationEngine'
import { captureActiveDictationInsertTarget, ensureDictationInsertFocusTracking, getLiveDictationInsertTarget, isDictationInsertTargetValid, type DictationInsertTarget } from '@/lib/dictation/insertAtCursor'
import { type DictationForegroundContext, inferUsageCategory, normalizeForegroundContext } from '@/lib/dictation/appContext'
import type { DictationForegroundSnapshot } from '@/types/electron'
import { isElectron } from '@/lib/platform/isElectron'

/**
 * Where a finished dictation should go: which app was in front when recording started, whether
 * it can take text, and whether the person has since moved on. Pure decisions over snapshots of
 * the foreground app; the only side effect is asking the OS which app is in front.
 */

const BROWSER_APPS = [
  'safari',
  'chrome',
  'chromium',
  'edge',
  'firefox',
  'arc',
  'brave',
  'opera',
  'vivaldi',
  'orion',
  'zen browser',
]

// Browsers host arbitrary editors (docs, mail, tickets) whose titles never match the
// category heuristics - a missed AX probe must not block pasting into a browser tab.
function isBrowserApp(appName: string): boolean {
  const name = String(appName || '').trim().toLowerCase()
  if (BROWSER_APPS.some((browser) => name.includes(browser))) return true
  return name.split(' ').includes('dia')
}


export function snapshotTextInputFocusAtCapture(
  foreground?: DictationForegroundSnapshot | DictationForegroundContext | null,
): boolean {
  if (captureActiveDictationInsertTarget()) return true

  const fromHotkey = foreground as DictationForegroundSnapshot | null | undefined
  if (fromHotkey?.textInputFocused) return true

  // Foreground is snapshotted on hotkey down before veenna steals focus - do not re-query OS here.
  return false
}

function isVeennaSelfApp(app?: { appName?: string | null; bundleId?: string | null } | null) {
  const appName = String(app?.appName || '').trim()
  const bundleId = String(app?.bundleId || '').trim()
  if (!appName && !bundleId) return true
  const hay = `${appName} ${bundleId}`.toLowerCase()
  const lower = appName.toLowerCase()
  return lower === 'electron' || hay.includes('veenna') || hay.includes('dictation')
}

function isVeennaDictationChromeFocus() {
  const active = document.activeElement
  if (!(active instanceof Element)) return false
  return Boolean(active.closest('[data-veenna-dictation-ui]'))
}

function appsRoughlyMatch(
  a?: { appName?: string | null; bundleId?: string | null } | null,
  b?: { appName?: string | null; bundleId?: string | null } | null,
) {
  const aBundle = String(a?.bundleId || '').trim()
  const bBundle = String(b?.bundleId || '').trim()
  if (aBundle && bBundle) return aBundle === bBundle
  const aName = String(a?.appName || '')
    .trim()
    .toLowerCase()
  const bName = String(b?.appName || '')
    .trim()
    .toLowerCase()
  if (aName && bName) return aName === bName
  return false
}

function appSupportsTextDictation(appName: string, windowTitle?: string | null) {
  if (inferUsageCategory(appName, windowTitle) !== 'other') return true
  return isBrowserApp(appName)
}

function userNavigatedAwayFromCapture(
  fg: DictationForegroundSnapshot | null | undefined,
  captured: DictationForegroundContext | null,
  source: DictationDeliverySnapshot = dictationEngine,
) {
  if (!captured || isVeennaSelfApp(captured)) return false

  const endFg = source.foregroundAtRecordingEnd
  const probes = [endFg, fg].filter((probe): probe is DictationForegroundSnapshot =>
    Boolean(probe && !isVeennaSelfApp(probe)),
  )

  for (const probe of probes) {
    if (!appsRoughlyMatch(probe, captured)) {
      return !probe.textInputFocused
    }
  }
  return false
}

function canPasteToCapturedExternalApp(
  captured: DictationForegroundContext,
  fg: DictationForegroundSnapshot | null,
  source: DictationDeliverySnapshot = dictationEngine,
) {
  if (userNavigatedAwayFromCapture(fg, captured, source)) return false

  if (source.hadTextInputFocusAtCapture) return true
  if (fg?.textInputFocused && appsRoughlyMatch(fg, captured)) return true

  const endFg = source.foregroundAtRecordingEnd
  if (endFg?.textInputFocused && appsRoughlyMatch(endFg, captured)) return true

  // AX often misses Monaco editors (Cursor, VS Code). Still paste when capture/end agree.
  if (!appSupportsTextDictation(captured.appName, captured.windowTitle)) return false

  if (endFg && !isVeennaSelfApp(endFg) && appsRoughlyMatch(endFg, captured)) return true

  // HUD processing is frontmost while the captured editor remains the intended target.
  return isVeennaSelfApp(fg) || !fg
}

export async function snapshotForegroundAtRecordingEnd() {
  if (!isElectron || !window.veennaElectron?.getForegroundApp) return null
  try {
    return (await window.veennaElectron.getForegroundApp()) ?? null
  } catch {
    return null
  }
}

export async function resolveDictationDeliveryTarget(
  source: DictationDeliverySnapshot = dictationEngine,
): Promise<{
  canDeliverToInput: boolean
  osPasteTarget: { appName?: string | null; bundleId?: string | null } | null
  staleDomTarget: DictationInsertTarget | null
}> {
  ensureDictationInsertFocusTracking()

  if (getLiveDictationInsertTarget()) {
    return { canDeliverToInput: true, osPasteTarget: null, staleDomTarget: null }
  }

  const capturedApp = source.capturedAppContext
  const capturedDom = source.capturedInsertTarget
  const hadFocusAtCapture = source.hadTextInputFocusAtCapture

  let fg: DictationForegroundSnapshot | null = null
  if (isElectron && window.veennaElectron?.getForegroundApp) {
    try {
      fg = (await window.veennaElectron.getForegroundApp()) ?? null
    } catch {
      fg = null
    }
  }

  if (fg?.textInputFocused && !isVeennaSelfApp(fg)) {
    return {
      canDeliverToInput: true,
      osPasteTarget: { appName: fg.appName, bundleId: fg.bundleId ?? null },
      staleDomTarget: null,
    }
  }

  if (
    hadFocusAtCapture &&
    capturedDom &&
    isDictationInsertTargetValid(capturedDom) &&
    (isVeennaSelfApp(fg) || isVeennaDictationChromeFocus() || Boolean(fg?.textInputFocused))
  ) {
    return { canDeliverToInput: true, osPasteTarget: null, staleDomTarget: capturedDom }
  }

  if (
    capturedApp &&
    !isVeennaSelfApp(capturedApp) &&
    canPasteToCapturedExternalApp(capturedApp, fg, source)
  ) {
    return {
      canDeliverToInput: true,
      osPasteTarget: {
        appName: capturedApp.appName,
        bundleId: capturedApp.bundleId ?? null,
      },
      staleDomTarget: null,
    }
  }

  // Try the currently focused in-app field (HUD → main window). Do not
  // reuse a field the user already left - that path shows on the HUD instead.
  return { canDeliverToInput: true, osPasteTarget: null, staleDomTarget: null }
}

async function snapshotRecordingAppContext(
  foreground?: DictationForegroundSnapshot | DictationForegroundContext | null,
): Promise<DictationForegroundContext | null> {
  const fromHotkey = normalizeForegroundContext(foreground ?? null, 'os')
  if (fromHotkey) return fromHotkey

  if (isElectron && window.veennaElectron?.getForegroundApp) {
    try {
      const snapshot = await window.veennaElectron.getForegroundApp()
      const fromOs = normalizeForegroundContext(snapshot, 'os')
      if (fromOs) return fromOs
    } catch {
      /* fall through to in-app context */
    }
  }

  if (isElectron) return null
  return null
}

export function fillRecordingAppContext(
  foreground: DictationForegroundSnapshot | DictationForegroundContext | null | undefined,
  sessionToken: number,
) {
  dictationEngine.appContextLookupToken = sessionToken
  dictationEngine.capturedAppContext = normalizeForegroundContext(foreground ?? null, 'os')
  if (dictationEngine.capturedAppContext) return
  void snapshotRecordingAppContext(null).then((context) => {
    if (dictationEngine.appContextLookupToken !== sessionToken) return
    if (dictationEngine.capturedAppContext) return
    dictationEngine.capturedAppContext = context
  })
}
