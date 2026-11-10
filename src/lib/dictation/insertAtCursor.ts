import { writeClipboardText } from '@/lib/clipboard/writeClipboardText'
import { insertIntoActiveDictationDraft } from '@/lib/dictation/dictationDraftSink'
import { getVeennaElectron, isElectron } from '@/lib/platform/isElectron'

export type DictationInsertTarget =
  | {
      kind: 'native'
      el: HTMLInputElement | HTMLTextAreaElement
      start: number
      end: number
    }
  | {
      kind: 'contenteditable'
      el: HTMLElement
    }

type DictationInsertMethod = 'dom' | 'os-paste' | 'clipboard'

export type DictationInsertResult = {
  ok: boolean
  /** How text was delivered. clipboard = available to paste anywhere with ⌘V / Ctrl+V. */
  method?: DictationInsertMethod
  reason?: string
}

let lastEditableTarget: DictationInsertTarget | null = null
let focusTrackingStarted = false

function isEditableInput(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false
  if (el.disabled || el.readOnly) return false
  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase()
    if (
      type === 'button' ||
      type === 'submit' ||
      type === 'reset' ||
      type === 'checkbox' ||
      type === 'radio' ||
      type === 'file' ||
      type === 'image' ||
      type === 'range' ||
      type === 'color' ||
      type === 'hidden'
    ) {
      return false
    }
  }
  return true
}

function contentEditableRoot(el: Element | null): HTMLElement | null {
  if (!(el instanceof HTMLElement)) return null
  if (el.isContentEditable) return el
  return el.closest('[contenteditable="true"]') as HTMLElement | null
}

function snapshotFromElement(el: Element | null): DictationInsertTarget | null {
  if (isEditableInput(el)) {
    return {
      kind: 'native',
      el,
      start: el.selectionStart ?? el.value.length,
      end: el.selectionEnd ?? el.value.length,
    }
  }
  const editable = contentEditableRoot(el)
  if (editable) return { kind: 'contenteditable', el: editable }
  return null
}

function targetStillValid(target: DictationInsertTarget | null): target is DictationInsertTarget {
  if (!target) return false
  if (!target.el.isConnected) return false
  if (target.kind === 'native') return isEditableInput(target.el)
  return target.el.isContentEditable
}

export function isDictationInsertTargetValid(target: DictationInsertTarget | null): boolean {
  return targetStillValid(target)
}

function deepActiveElement(): Element | null {
  let el: Element | null = document.activeElement instanceof Element ? document.activeElement : null
  while (el?.shadowRoot?.activeElement) {
    el = el.shadowRoot.activeElement
  }
  return el
}

function snapshotActiveElement(): DictationInsertTarget | null {
  return snapshotFromElement(deepActiveElement())
}

function onFocusIn(event: FocusEvent) {
  const next = snapshotFromElement(event.target as Element | null)
  if (next) lastEditableTarget = next
}

function onSelectionChange() {
  const live = snapshotActiveElement()
  if (live) lastEditableTarget = live
}

/** Editable field that currently has DOM focus (not a remembered target). */
export function getLiveDictationInsertTarget(): DictationInsertTarget | null {
  ensureDictationInsertFocusTracking()
  return snapshotActiveElement()
}

/** Keep the last editable caret target so mic-button focus does not lose the insert site. */
export function ensureDictationInsertFocusTracking() {
  if (focusTrackingStarted || typeof document === 'undefined') return
  focusTrackingStarted = true
  document.addEventListener('focusin', onFocusIn, true)
  document.addEventListener('selectionchange', onSelectionChange)
  const initial = snapshotActiveElement()
  if (initial) lastEditableTarget = initial
}

/** Capture the current/last editable field before recording steals focus. */
export function captureDictationInsertTarget() {
  ensureDictationInsertFocusTracking()
  const live = snapshotActiveElement()
  if (live) {
    lastEditableTarget = live
    return live
  }
  if (targetStillValid(lastEditableTarget)) return lastEditableTarget
  return null
}

/**
 * Field that currently has focus, or the field dictation chrome (mic button)
 * just stole focus from. Does not return a field the user already left.
 */
export function captureActiveDictationInsertTarget(): DictationInsertTarget | null {
  ensureDictationInsertFocusTracking()
  const live = snapshotActiveElement()
  if (live) return live
  const active = deepActiveElement()
  if (
    active instanceof Element &&
    active.closest('[data-veenna-dictation-ui]') &&
    targetStillValid(lastEditableTarget)
  ) {
    return lastEditableTarget
  }
  return null
}

function dispatchNativeInput(el: HTMLInputElement | HTMLTextAreaElement) {
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function setNativeInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter) setter.call(el, value)
  else el.value = value
}

function insertIntoNative(
  target: Extract<DictationInsertTarget, { kind: 'native' }>,
  text: string,
): boolean {
  const { el } = target
  if (!isEditableInput(el)) return false

  el.focus()
  const start = el.selectionStart ?? target.start
  const end = el.selectionEnd ?? target.end
  const next = el.value.slice(0, start) + text + el.value.slice(end)
  setNativeInputValue(el, next)
  const caret = start + text.length
  try {
    el.setSelectionRange(caret, caret)
  } catch {
    /* some input types reject selection */
  }
  dispatchNativeInput(el)
  lastEditableTarget = { kind: 'native', el, start: caret, end: caret }
  return true
}

function insertIntoContentEditable(el: HTMLElement, text: string): boolean {
  el.focus()
  try {
    if (document.execCommand('insertText', false, text)) return true
  } catch {
    /* fall through */
  }

  const selection = window.getSelection()
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    if (el.contains(range.commonAncestorContainer)) {
      range.deleteContents()
      const node = document.createTextNode(text)
      range.insertNode(node)
      range.setStartAfter(node)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
      return true
    }
  }

  try {
    if (document.execCommand('paste')) return true
  } catch {
    /* fall through */
  }

  el.appendChild(document.createTextNode(text))
  el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
  return true
}

function insertIntoDomTarget(
  text: string,
  staleTarget: DictationInsertTarget | null = null,
): boolean {
  const live = snapshotActiveElement()
  const target = targetStillValid(live)
    ? live
    : staleTarget && targetStillValid(staleTarget)
      ? staleTarget
      : null
  if (!target) return false

  if (target.kind === 'native') return insertIntoNative(target, text)
  return insertIntoContentEditable(target.el, text)
}

export type InAppDictationInsertResult = {
  ok: boolean
  /** True when an editable field currently has DOM focus in this window. */
  focused: boolean
}

/**
 * Insert into this window's currently focused editable field.
 * When `allowRememberedTarget` is set (sticky widgets), fall back to the last
 * caret after the HUD steals focus.
 */
export function applyInAppDictationInsert(
  text: string,
  options: { allowRememberedTarget?: boolean } = {},
): InAppDictationInsertResult {
  ensureDictationInsertFocusTracking()
  const live = getLiveDictationInsertTarget()
  const remembered =
    options.allowRememberedTarget && targetStillValid(lastEditableTarget)
      ? lastEditableTarget
      : null
  const target = live || remembered
  const focused = Boolean(live)
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, focused }
  if (target) {
    try {
      target.el.focus()
    } catch {
      /* window may be blurred; value insert still works */
    }
    if (insertIntoActiveDictationDraft(trimmed, target.el)) return { ok: true, focused: true }
  }
  return { ok: insertIntoDomTarget(trimmed, target), focused: focused || Boolean(target) }
}

/** Insert into this window's currently focused editable field. */
export function insertDictationTextIntoLocalDom(text: string): boolean {
  return applyInAppDictationInsert(text).ok
}

async function insertViaMainWindow(text: string): Promise<InAppDictationInsertResult> {
  const api = getVeennaElectron()
  if (!api?.insertTextInApp || !api.isDictationHud) return { ok: false, focused: false }
  try {
    const result = await api.insertTextInApp(text)
    return {
      ok: result?.ok === true,
      focused: result?.focused === true || result?.ok === true,
    }
  } catch {
    return { ok: false, focused: false }
  }
}

export type DictationInsertDeliveryOptions = {
  /** When set, OS paste only runs for this app - never the last remembered external app. */
  osPasteTarget?: { appName?: string | null; bundleId?: string | null; intoOwnApp?: boolean } | null
  /** Insert into this field when DOM focus moved to dictation chrome (mic button). */
  staleDomTarget?: DictationInsertTarget | null
}

async function pasteViaElectron(
  text: string,
  targetApp?: { appName?: string | null; bundleId?: string | null; intoOwnApp?: boolean } | null,
  allowFallbackTarget = false,
): Promise<{ ok: boolean; reason?: string }> {
  const api = getVeennaElectron()
  if (!api?.pasteText) return { ok: false, reason: 'unsupported' }
  try {
    const result = await api.pasteText(text, targetApp ?? null, allowFallbackTarget)
    if (result?.ok === true) return { ok: true }
    return {
      ok: false,
      reason: typeof result?.reason === 'string' ? result.reason : 'paste_failed',
    }
  } catch {
    return { ok: false, reason: 'paste_failed' }
  }
}

/**
 * Deliver dictation text into the user's current text field when possible.
 *
 * Desktop (Electron): paste into the focused field of another app, or into
 * the input that currently has focus in veenna If nothing is focused, the
 * caller shows the transcript on the HUD instead of inserting into a stale field.
 */
export async function insertDictationTextAtCursor(
  text: string,
  delivery: DictationInsertDeliveryOptions = {},
): Promise<DictationInsertResult> {
  const trimmed = text.trim()
  if (!trimmed) return { ok: false }

  ensureDictationInsertFocusTracking()

  const staleDomTarget = delivery.staleDomTarget ?? null
  const osPasteTarget = delivery.osPasteTarget ?? null
  const hasExternalTarget = Boolean(
    osPasteTarget && !osPasteTarget.intoOwnApp && (osPasteTarget.appName || osPasteTarget.bundleId),
  )

  if (isElectron) {
    if (hasExternalTarget) {
      const pasteResult = await pasteViaElectron(trimmed, osPasteTarget, false)
      if (pasteResult.ok) return { ok: true, method: 'os-paste' }
      const copied = await writeClipboardText(trimmed)
      if (copied) return { ok: true, method: 'clipboard', reason: 'paste_failed' }
      return { ok: false, reason: pasteResult.reason || 'no_target' }
    }

    if (insertIntoDomTarget(trimmed, staleDomTarget)) return { ok: true, method: 'dom' }

    const inApp = await insertViaMainWindow(trimmed)
    if (inApp.ok) return { ok: true, method: 'dom' }

    if (inApp.focused) {
      const ownPaste = await pasteViaElectron(trimmed, { intoOwnApp: true }, false)
      if (ownPaste.ok) return { ok: true, method: 'os-paste' }
    }

    const copied = await writeClipboardText(trimmed)
    if (copied) return { ok: true, method: 'clipboard', reason: 'no_target' }
    return { ok: false, reason: 'no_target' }
  }

  if (insertIntoDomTarget(trimmed, staleDomTarget)) return { ok: true, method: 'dom' }
  const copied = await writeClipboardText(trimmed)
  return copied ? { ok: true, method: 'clipboard' } : { ok: false }
}
