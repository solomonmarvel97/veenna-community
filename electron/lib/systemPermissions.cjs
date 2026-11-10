'use strict'

/**
 * The permissions veenna asks the operating system for, in one place the user
 * can see.
 *
 * Each desktop OS gates a different set, so the list is per platform rather
 * than one list with things greyed out:
 *
 * - macOS gates the most, through TCC. It will not let an app grant itself
 *   anything, so "request" means "trigger the system's own prompt", and it will
 *   not let an app revoke a grant either. The closest thing is `tccutil reset`,
 *   which puts a permission back to never-asked for this bundle id, and which
 *   only works because veenna is not App Sandboxed.
 * - Windows gates the microphone through its own privacy settings. The status
 *   is readable, but there is no prompt to raise and no way to reset, so the
 *   only action is opening the right Settings page.
 * - Linux desktops do not gate any of this for an ordinary application, so
 *   there is nothing here to manage and the page says so.
 *
 * Where a system refuses, the fallback is always to open its settings page,
 * which works everywhere.
 */

const childProcess = require('child_process')
const { app, systemPreferences, shell } = require('electron')

const PLATFORM = process.platform
const IS_MAC = PLATFORM === 'darwin'

/** macOS System Settings deep links. Stable across Ventura and later. */
const PRIVACY_PANE = 'x-apple.systempreferences:com.apple.preference.security'

/**
 * @typedef {'granted'|'denied'|'not-determined'|'restricted'|'unknown'|'unsupported'} PermissionStatus
 */

/**
 * Each entry says what the permission is for in the user's terms, not the
 * platform's. `tccService` is the name `tccutil` knows it by; absent means it
 * cannot be reset, which is every permission outside macOS.
 */
const PERMISSIONS_BY_PLATFORM = {
  darwin: [
    {
      id: 'microphone',
      label: 'Microphone',
      purpose: 'Dictation.',
      pane: `${PRIVACY_PANE}?Privacy_Microphone`,
      tccService: 'Microphone',
      canRequest: true,
    },
    {
      id: 'accessibility',
      label: 'Accessibility',
      purpose: 'Typing dictated text into whatever app you are in.',
      pane: `${PRIVACY_PANE}?Privacy_Accessibility`,
      tccService: 'Accessibility',
      canRequest: true,
    },
    {
      id: 'input-monitoring',
      label: 'Input monitoring',
      purpose: 'Noticing the hold-to-talk key while another app has focus.',
      pane: `${PRIVACY_PANE}?Privacy_ListenEvent`,
      tccService: 'ListenEvent',
      canRequest: false,
    },
  ],
  win32: [
    {
      id: 'microphone',
      label: 'Microphone',
      purpose: 'Dictation.',
      pane: 'ms-settings:privacy-microphone',
      // `askForMediaAccess` is macOS only, and Windows has no reset. Reading the
      // status and opening the page is the whole of what it offers.
      canRequest: false,
    },
  ],
  // Linux desktops leave these to the session and its portals rather than to a
  // per-app grant, so there is nothing to list.
  linux: [],
}

const PERMISSIONS = PERMISSIONS_BY_PLATFORM[PLATFORM] || []

/**
 * Settings pages we can open but cannot read or reset from the main process.
 * Location is the case: Chromium raises the prompt and reports the answer to
 * the page (Permissions API), and macOS has no tccutil service for it, so the
 * renderer owns its status and this is only where "change it" leads.
 */
const OPEN_ONLY_PANES = {
  darwin: { location: `${PRIVACY_PANE}?Privacy_LocationServices` },
  win32: { location: 'ms-settings:privacy-location' },
}

const BY_ID = new Map(PERMISSIONS.map((entry) => [entry.id, entry]))

/**
 * Permissions cleared during this run of the app.
 *
 * Every macOS status probe caches for the life of the process, so after a reset
 * they all keep insisting the grant is still there. Having just removed it
 * ourselves, we know more than they do, and the alternative is telling somebody
 * their click did nothing. Dropped as soon as they go and do something about
 * the permission again, since from that point the system knows better than we
 * do. Not persisted: a relaunch clears the caches, so the probes are honest
 * again by the time this is gone.
 */
const clearedIds = new Set()

/**
 * Input Monitoring has no status API. The dictation key monitor is the only
 * thing that knows, and it only knows once it has tried, so this is wired from
 * the outside rather than guessed at here.
 *
 * @type {() => { inputMonitoring?: boolean } | null}
 */
let readMonitorStatus = () => null

function setInputMonitoringProbe(fn) {
  readMonitorStatus = typeof fn === 'function' ? fn : () => null
}

/** @returns {PermissionStatus} */
function statusFor(id) {
  if (!BY_ID.has(id)) return 'unsupported'
  try {
    // getMediaAccessStatus is the one probe both macOS and Windows answer.
    if (id === 'microphone') return systemPreferences.getMediaAccessStatus('microphone')
    if (id === 'accessibility') {
      // `false` so merely opening this page never throws a prompt at somebody.
      return systemPreferences.isTrustedAccessibilityClient(false) ? 'granted' : 'not-determined'
    }
    if (id === 'input-monitoring') {
      const probed = readMonitorStatus()
      if (probed && typeof probed.inputMonitoring === 'boolean') {
        return probed.inputMonitoring ? 'granted' : 'not-determined'
      }
      return 'unknown'
    }
  } catch {
    return 'unknown'
  }
  return 'unknown'
}

function reportedStatus(entry) {
  if (clearedIds.has(entry.id)) return 'not-determined'
  return statusFor(entry.id)
}

function publicPermission(entry) {
  return {
    id: entry.id,
    label: entry.label,
    purpose: entry.purpose,
    status: reportedStatus(entry),
    canRequest: Boolean(entry.canRequest),
    // Only macOS has anything that resets a grant.
    canReset: IS_MAC && Boolean(entry.tccService),
    canOpenSettings: Boolean(entry.pane),
  }
}

function listPermissions() {
  return {
    // "Supported" means this OS has something for the page to manage, not that
    // veenna runs on it.
    supported: PERMISSIONS.length > 0,
    platform: PLATFORM,
    permissions: PERMISSIONS.map(publicPermission),
  }
}

async function requestPermission(id) {
  const entry = BY_ID.get(String(id || ''))
  if (!entry) return { ok: false, reason: 'unknown_permission' }

  // They are dealing with it again, so stop overriding the probe.
  const wasClearedThisRun = clearedIds.delete(entry.id)

  /*
   * A permission cleared while the app was running cannot be prompted for from
   * inside that same app.
   *
   * The stored grant is gone, but this process still holds macOS's cached
   * decision, so `askForMediaAccess` returns straight away and draws nothing -
   * which is why the button looked dead. Rather than call an API we know is
   * spent, go where granting actually works.
   */
  if (wasClearedThisRun || !entry.canRequest) {
    const opened = await openPermissionSettings(entry.id)
    return {
      ok: Boolean(opened.ok),
      opened: Boolean(opened.ok),
      promptUnavailable: wasClearedThisRun,
      reason: opened.ok ? undefined : opened.reason,
      status: statusFor(entry.id),
    }
  }

  try {
    if (entry.id === 'microphone') {
      // The return value is a direct answer from the system, unlike the status
      // probes, so it is what we believe rather than a re-read afterwards.
      const granted = Boolean(await systemPreferences.askForMediaAccess('microphone'))
      if (granted) return { ok: true, status: 'granted' }
    } else if (entry.id === 'accessibility') {
      // `true` is what puts the system's own "open Settings?" dialog on screen.
      if (systemPreferences.isTrustedAccessibilityClient(true)) {
        return { ok: true, status: 'granted' }
      }
      // That dialog is the prompt. Opening the pane on top of it would be two
      // windows asking the same thing.
      return { ok: true, status: statusFor(entry.id) }
    }
  } catch (err) {
    return { ok: false, reason: err?.message || 'request_failed', status: statusFor(entry.id) }
  }

  // Asked and refused, or no prompt appeared. Either way the pane still works.
  const opened = await openPermissionSettings(entry.id)
  return { ok: true, opened: Boolean(opened.ok), status: statusFor(entry.id) }
}

async function openPermissionSettings(id) {
  const key = String(id || '')
  const pane = BY_ID.get(key)?.pane || (OPEN_ONLY_PANES[PLATFORM] || {})[key]
  if (!pane) return { ok: false, reason: 'unsupported' }
  try {
    await shell.openExternal(pane)
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: err?.message || 'open_failed' }
  }
}

/**
 * Whose grants to reset.
 *
 * In development the app running is Electron itself, and the permissions macOS
 * remembers belong to Electron's bundle id, not ours. Resetting `com.veenna`
 * there would report success and change nothing anybody could see.
 *
 * A Mac App Store build is sandboxed, and a sandboxed process cannot drive
 * tccutil at all, so it gets no target and the caller falls back to Settings.
 *
 * @param {{ mas?: boolean, packaged?: boolean }} env
 * @returns {string|null}
 */
function tccutilTarget(env = {}) {
  if (env.mas) return null
  if (env.packaged === false) return 'com.github.Electron'
  return 'com.veenna'
}

function bundleId() {
  let packaged = true
  try {
    if (app && typeof app.isPackaged === 'boolean') packaged = app.isPackaged
  } catch {
    /* treat an unreadable app as packaged */
  }
  return tccutilTarget({ mas: Boolean(process.mas), packaged })
}

function runTccutil(service, id) {
  return new Promise((resolve) => {
    // Called through the module object so a test can stand in for it.
    childProcess.execFile(
      'tccutil',
      ['reset', service, id],
      { timeout: 10_000 },
      (error, _stdout, stderr) => {
        if (error) {
          resolve({ ok: false, reason: String(stderr || error.message || 'tccutil_failed').trim() })
          return
        }
        resolve({ ok: true })
      },
    )
  })
}

/**
 * Put a permission back to never-asked.
 *
 * This is as close to "revoke" as macOS allows, and it takes effect the moment
 * tccutil returns: the stored grant is gone, and the next time veenna needs it
 * the system asks from scratch.
 *
 * What is not immediate is *reading it back*. Every status probe macOS offers a
 * running app answers from a per-process cache: `AXIsProcessTrusted`,
 * `IOHIDCheckAccess`, and `AVCaptureDevice.authorizationStatus` behind
 * `getMediaAccessStatus` all keep reporting the old grant until the app is
 * relaunched. Polling for a change was waiting on a value that was never going
 * to move, and reporting it left the row saying "Allowed" straight after the
 * user cleared it.
 *
 * So the reset wins. Having just removed the grant ourselves we know more than
 * the cache does, and that override stands until the user goes and deals with
 * the permission again, at which point the system knows better than we do.
 */
async function resetPermission(id) {
  const entry = BY_ID.get(String(id || ''))
  if (!entry) return { ok: false, reason: 'unknown_permission' }
  // tccutil is a macOS tool; nothing else offers a way back to never-asked.
  if (!IS_MAC || !entry.tccService) return { ok: false, reason: 'not_resettable' }

  const target = bundleId()
  if (!target) return { ok: false, reason: 'sandboxed' }

  const result = await runTccutil(entry.tccService, target)
  if (!result.ok) {
    // tccutil refuses under some SIP and MDM configurations. Falling back to the
    // Settings pane means the user can still finish the job by hand - and if
    // even that fails, say so rather than pointing at a window nobody opened.
    const opened = await openPermissionSettings(entry.id)
    return { ...result, opened: Boolean(opened.ok), status: statusFor(entry.id) }
  }

  clearedIds.add(entry.id)
  return { ok: true, status: 'not-determined' }
}

module.exports = {
  PERMISSIONS,
  PERMISSIONS_BY_PLATFORM,
  tccutilTarget,
  __clearedIdsForTests: clearedIds,
  listPermissions,
  requestPermission,
  resetPermission,
  openPermissionSettings,
  setInputMonitoringProbe,
  statusFor,
}
