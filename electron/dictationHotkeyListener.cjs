const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const { systemPreferences } = require('electron')
const { getForegroundContext } = require('./lib/nativePlatform.cjs')

let macMonitor = null
let macMonitorGetWebContents = null
let macMonitorRestartTimer = null
let macMonitorReady = false
let macMonitorConsumesEvents = false
let macMonitorInputMonitoring = false
let macMonitorTakesCommands = false
let macMonitorCommandId = 0
/** @type {Map<string, { resolve: (reply: object) => void, timer: NodeJS.Timeout }>} */
const macMonitorCommands = new Map()
let macMonitorRestartAttempts = 0
let uiohookStarted = false
let uiohook = null
let shortcutHeldWindow = false
let shortcutHeldGlobal = false
let pendingHotkeyDown = false
let windowEndTimer = null
let stoppingMonitor = false

function sendHotkey(webContents, action, foreground) {
  if (action === 'up') pendingHotkeyDown = false
  if (!webContents || webContents.isDestroyed()) {
    if (action === 'down') pendingHotkeyDown = true
    return
  }
  if (action === 'down' && webContents.isLoading()) {
    pendingHotkeyDown = true
    return
  }
  const payload = foreground ? { action, foreground } : { action }
  // Deliver hotkey to the HUD first so recording mode is active before the window is shown.
  webContents.send('dictation-hotkey', payload)
  try {
    const overlay = require('./lib/overlayWindow.cjs')
    if (
      action === 'down' ||
      action === 'confirm' ||
      action === 'hands-free-mode'
    ) {
      overlay.noteOverlayActivity()
    } else if (action === 'up') {
      overlay.noteOverlayDictationKeyReleased()
    }
  } catch {
    /* overlay may not be ready yet */
  }
}

function notifyWebContentsReady(webContents) {
  if (!pendingHotkeyDown || !webContents || webContents.isDestroyed()) return
  pendingHotkeyDown = false
  sendHotkey(webContents, 'down')
}

const FOREGROUND_HOTKEY_ACTIONS = new Set(['down', 'hands-free-mode'])

async function sendActionWithForeground(webContents, action) {
  if (!webContents || webContents.isDestroyed()) return
  if (FOREGROUND_HOTKEY_ACTIONS.has(action)) {
    // Deliver down immediately - awaiting OS foreground must not let key-up overtake quick taps.
    sendHotkey(webContents, action, null)
    try {
      const foreground = await getForegroundContext()
      if (!webContents.isDestroyed() && foreground) {
        sendHotkey(webContents, 'foreground', foreground)
      }
    } catch {
      /* foreground optional */
    }
    return
  }
  sendHotkey(webContents, action)
}

async function sendHotkeyWithContext(webContents, action) {
  return sendActionWithForeground(webContents, action)
}

function isOptionInput(input) {
  return (
    input.code === 'AltLeft' ||
    input.code === 'AltRight' ||
    (String(input.key || '').toLowerCase() === 'alt' &&
      (Number(input.location) === 1 || Number(input.location) === 2))
  )
}

function isRightAltInput(input) {
  return (
    input.code === 'AltRight' ||
    (String(input.key || '').toLowerCase() === 'alt' && Number(input.location) === 2)
  )
}

function isDictationTriggerInput(input) {
  if (process.platform === 'darwin') return isOptionInput(input)
  if (process.platform === 'win32') return isRightAltInput(input)
  return false
}

function clearWindowEndTimer() {
  if (windowEndTimer) clearTimeout(windowEndTimer)
  windowEndTimer = null
}

/**
 * Asks the running key monitor to do something macOS would otherwise need a new
 * osascript process for. Resolves null when it can't be asked (an older binary,
 * not running), so the caller knows nothing happened and can use osascript.
 * @param {string} command
 * @param {number} timeoutMs
 * @returns {Promise<object | null>}
 */
function macMonitorCommand(command, timeoutMs) {
  if (!macMonitorTakesCommands || !macMonitor?.stdin?.writable) return Promise.resolve(null)
  macMonitorCommandId += 1
  const id = String(macMonitorCommandId)
  return new Promise((resolve) => {
    const timer = setTimeout(() => settleMacMonitorCommand({ reply: id, ok: false, reason: 'timeout' }), timeoutMs)
    macMonitorCommands.set(id, { resolve, timer })
    macMonitor.stdin.write(`${id} ${command}\n`)
  })
}

function settleMacMonitorCommand(payload) {
  const pending = macMonitorCommands.get(String(payload.reply))
  if (!pending) return
  macMonitorCommands.delete(String(payload.reply))
  clearTimeout(pending.timer)
  pending.resolve(payload)
}

function resolvePackagedPath(filePath) {
  // Native binaries cannot execute from inside app.asar.
  if (filePath.includes(`${path.sep}app.asar${path.sep}`)) {
    return filePath.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`)
  }
  return filePath
}

function macMonitorBinaryPath() {
  const { app } = require('electron')
  if (app?.isPackaged) {
    const besideExec = path.join(path.dirname(process.execPath), 'veenna-dictation-key-monitor')
    if (fs.existsSync(besideExec)) return besideExec
  }
  return resolvePackagedPath(path.join(__dirname, 'macos-dictation-key-monitor'))
}

function macMonitorSourcePath() {
  return path.join(__dirname, 'macos-dictation-key-monitor.swift')
}

function replaceRunningMacMonitor() {
  // Never mid-dictation: the exit would count as letting go of the key.
  if (shortcutHeldGlobal) {
    setTimeout(replaceRunningMacMonitor, 1000)
    return
  }
  // One still waiting on a permission restarts itself once it has it.
  if (isMacMonitorAlive() && macMonitorReady) macMonitor.kill()
}

function ensureMacMonitorBuilt() {
  const bin = macMonitorBinaryPath()
  const { app } = require('electron')
  if (app?.isPackaged) {
    return fs.existsSync(bin) ? bin : null
  }

  const src = macMonitorSourcePath()
  if (!fs.existsSync(src) && !fs.existsSync(bin)) return null

  const { ensureSwiftHelper } = require('./lib/swiftHelper.cjs')
  return ensureSwiftHelper(bin, src, ['-O', '-o', bin, src], {
    isPackaged: false,
    onRebuilt: (built) => {
      if (!built || !macMonitorGetWebContents) return
      if (!isMacMonitorAlive()) {
        startMacMonitor(macMonitorGetWebContents)
        return
      }
      // Still the old build, started before this one finished: swap it, or the
      // change stays unused until the next launch. Its exit restarts the monitor.
      replaceRunningMacMonitor()
    },
  })
}

function attachWindowListener(getWebContents) {
  return (window) => {
    if (!window || window.isDestroyed()) return

    // A window only hears keys while it has focus. If something takes focus
    // mid-hold (the macOS permission prompt, above all) the key-up goes there
    // instead, and push-to-talk would sit on "Dictating" with no way out. Losing
    // focus while held counts as letting go.
    window.on('blur', () => {
      if (!shortcutHeldWindow || shortcutHeldGlobal) return
      shortcutHeldWindow = false
      sendHotkey(getWebContents(), 'up')
    })

    window.webContents.on('before-input-event', (event, input) => {
      const wc = getWebContents()
      if (!isDictationTriggerInput(input)) return

      if (input.type === 'keyDown') {
        if (input.isAutoRepeat || shortcutHeldGlobal) return
        event.preventDefault()
        if (shortcutHeldWindow) return
        shortcutHeldWindow = true
        void sendHotkeyWithContext(wc, 'down')
        return
      }

      if (input.type !== 'keyUp' || shortcutHeldGlobal || !shortcutHeldWindow) return
      event.preventDefault()
      shortcutHeldWindow = false
      sendHotkey(wc, 'up')
    })
  }
}

function isMacMonitorAlive() {
  return Boolean(macMonitor && macMonitor.exitCode === null && !macMonitor.killed)
}

function scheduleMacMonitorRestart() {
  if (stoppingMonitor || process.platform !== 'darwin') return
  if (macMonitorRestartTimer) return
  if (macMonitorRestartAttempts >= 5) {
    console.error('[dictation-hotkey] Giving up restarting macOS monitor after repeated failures')
    return
  }
  const delay = 800 + macMonitorRestartAttempts * 700
  macMonitorRestartAttempts += 1
  macMonitorRestartTimer = setTimeout(() => {
    macMonitorRestartTimer = null
    if (stoppingMonitor || isMacMonitorAlive() || !macMonitorGetWebContents) return
    console.warn('[dictation-hotkey] Restarting macOS monitor…')
    startMacMonitor(macMonitorGetWebContents)
  }, delay)
}

function startMacMonitor(getWebContents) {
  if (process.platform !== 'darwin') return { ok: false, reason: 'unsupported' }
  macMonitorGetWebContents = getWebContents

  if (isMacMonitorAlive()) return { ok: true, reason: 'already_running' }
  macMonitor = null

  const trusted = systemPreferences.isTrustedAccessibilityClient(false)
  if (!trusted) {
    console.warn(
      '[dictation-hotkey] Accessibility is not enabled - enable veenna in System Settings → Privacy & Security → Accessibility',
    )
  }

  let bin
  try {
    bin = ensureMacMonitorBuilt()
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'build_failed' }
  }
  if (!bin) return { ok: false, reason: 'monitor_missing' }

  try {
    macMonitor = spawn(bin, [], { stdio: ['pipe', 'pipe', 'pipe'] })
    // A write racing the helper's exit must not take the main process down with it.
    macMonitor.stdin.on('error', () => {})
  } catch (err) {
    macMonitor = null
    scheduleMacMonitorRestart()
    return { ok: false, reason: err instanceof Error ? err.message : 'spawn_failed' }
  }

  macMonitor.stderr.on('data', (chunk) => {
    const text = String(chunk)
    if (text.includes('"error"')) {
      console.error('[dictation-hotkey]', text.trim())
    } else if (text.includes('"ready":true')) {
      macMonitorReady = true
      macMonitorRestartAttempts = 0
      macMonitorConsumesEvents = text.includes('"consume":true')
      macMonitorInputMonitoring = text.includes('"inputMonitoring":true')
      macMonitorTakesCommands = text.includes('"commands":true')
      console.log(
        `[dictation-hotkey] macOS Option monitor ready${macMonitorConsumesEvents ? ' (consuming Option events)' : ' (listen-only)'}${macMonitorInputMonitoring ? '' : ' - enable Input Monitoring for veenna-dictation-key-monitor'}`,
      )
    }
  })

  macMonitor.stdout.on('data', (chunk) => {
    for (const line of String(chunk).split('\n')) {
      if (!line.trim()) continue
      try {
        const payload = JSON.parse(line)
        if (payload.reply) {
          settleMacMonitorCommand(payload)
          continue
        }
        const wc = getWebContents()
        if (payload.action === 'down') {
          shortcutHeldGlobal = true
          shortcutHeldWindow = false
          clearWindowEndTimer()
          console.log('[dictation-hotkey] down')
          void sendHotkeyWithContext(wc, 'down')
        } else if (payload.action === 'hands-free-mode') {
          console.log('[dictation-hotkey] hands-free-mode')
          void sendActionWithForeground(wc, 'hands-free-mode')
        } else if (payload.action === 'confirm') {
          shortcutHeldGlobal = false
          console.log('[dictation-hotkey] confirm')
          sendHotkey(wc, 'confirm')
        } else if (payload.action === 'up') {
          shortcutHeldGlobal = false
          console.log('[dictation-hotkey] up')
          sendHotkey(wc, 'up')
        }
      } catch {
        /* ignore malformed lines */
      }
    }
  })

  macMonitor.on('exit', (code, signal) => {
    const wasReady = macMonitorReady
    // The monitor is gone and so is the key-up it owed us; end the hold here.
    if (shortcutHeldGlobal) sendHotkey(getWebContents(), 'up')
    macMonitor = null
    macMonitorReady = false
    macMonitorConsumesEvents = false
    macMonitorInputMonitoring = false
    macMonitorTakesCommands = false
    for (const id of [...macMonitorCommands.keys()]) settleMacMonitorCommand({ reply: id, ok: false })
    shortcutHeldGlobal = false
    console.warn('[dictation-hotkey] mac monitor exited', { code, signal, wasReady })
    // Exit 0 is the monitor asking to be restarted: a permission it lacked was just granted.
    if (wasReady || code === 0) {
      if (code === 0) macMonitorRestartAttempts = 0
      scheduleMacMonitorRestart()
    }
  })

  return { ok: true, accessibilityTrusted: trusted }
}

function startWindowsGlobalListener(getWebContents) {
  if (process.platform !== 'win32' || uiohookStarted) {
    return { ok: false, reason: 'unsupported_or_running' }
  }

  try {
    const { uIOhook, UiohookKey, EventType } = require('uiohook-napi')
    uiohook = uIOhook
    let optionHeld = false
    let sessionEngaged = false
    let handsFreeLatched = false

    function resetSession(emitUpEvent) {
      const wasEngaged = sessionEngaged || handsFreeLatched
      sessionEngaged = false
      handsFreeLatched = false
      shortcutHeldGlobal = false
      if (emitUpEvent && wasEngaged) {
        sendHotkey(getWebContents(), 'up')
      }
    }

    uIOhook.on('keydown', (event) => {
      if (event.type !== EventType.EVENT_KEY_PRESSED) return

      if (
        optionHeld &&
        event.keycode !== UiohookKey.AltRight &&
        event.keycode !== UiohookKey.AltLeft &&
        sessionEngaged &&
        !handsFreeLatched
      ) {
        resetSession(true)
      }

      if (event.keycode !== UiohookKey.AltRight) return
      if (optionHeld) return
      optionHeld = true

      if (handsFreeLatched) {
        sendHotkey(getWebContents(), 'confirm')
        resetSession(false)
        return
      }

      if (!sessionEngaged) {
        sessionEngaged = true
        shortcutHeldGlobal = true
        void sendHotkeyWithContext(getWebContents(), 'down')
      }
    })

    uIOhook.on('keyup', (event) => {
      if (event.type !== EventType.EVENT_KEY_RELEASED) return
      if (event.keycode !== UiohookKey.AltRight) return
      if (!optionHeld) return
      optionHeld = false

      if (handsFreeLatched) return
      if (!sessionEngaged) return
      resetSession(true)
    })

    uIOhook.start()
    uiohookStarted = true
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'uiohook_failed' }
  }
}

function startDictationHotkeyListener(getWebContents) {
  if (process.platform === 'darwin') return startMacMonitor(getWebContents)
  if (process.platform === 'win32') return startWindowsGlobalListener(getWebContents)
  return { ok: false, reason: 'unsupported_platform' }
}

function stopDictationHotkeyListener() {
  stoppingMonitor = true
  if (macMonitorRestartTimer) {
    clearTimeout(macMonitorRestartTimer)
    macMonitorRestartTimer = null
  }
  if (macMonitor) {
    macMonitor.kill()
    macMonitor = null
  }
  clearWindowEndTimer()
  shortcutHeldGlobal = false
  shortcutHeldWindow = false
  pendingHotkeyDown = false

  if (uiohookStarted && uiohook) {
    try {
      uiohook.stop()
    } catch {
      /* ignore */
    }
    uiohookStarted = false
    uiohook = null
  }
  stoppingMonitor = false
}

function accessibilityStatus() {
  if (process.platform !== 'darwin') {
    return {
      required: false,
      trusted: true,
      hotkeyConsumesEvents: true,
      inputMonitoring: true,
      monitorReady: true,
      monitorBinary: null,
    }
  }
  let monitorBinary = null
  try {
    monitorBinary = macMonitorBinaryPath()
  } catch {
    monitorBinary = null
  }
  return {
    required: true,
    trusted: systemPreferences.isTrustedAccessibilityClient(false),
    hotkeyConsumesEvents: macMonitorConsumesEvents,
    inputMonitoring: macMonitorInputMonitoring,
    // inputMonitoring is only meaningful once the monitor has said it is ready.
    monitorReady: isMacMonitorAlive() && macMonitorReady,
    monitorBinary,
  }
}

function promptAccessibility() {
  if (process.platform !== 'darwin') return true
  return systemPreferences.isTrustedAccessibilityClient(true)
}

module.exports = {
  attachWindowListener,
  macMonitorCommand,
  notifyWebContentsReady,
  startDictationHotkeyListener,
  stopDictationHotkeyListener,
  accessibilityStatus,
  promptAccessibility,
}
