'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const childProcess = require('child_process')
const permissions = require('./systemPermissions.cjs')

test('resets belong to whichever bundle macOS actually recorded them against', () => {
  // The packaged app.
  assert.equal(permissions.tccutilTarget({ mas: false, packaged: true }), 'com.veenna')

  // In development the running app is Electron, and the grants are Electron's.
  // Resetting com.veenna here would report success and change nothing.
  assert.equal(permissions.tccutilTarget({ mas: false, packaged: false }), 'com.github.Electron')

  // A sandboxed App Store build cannot drive tccutil at all, so there is no
  // target and the caller has to fall back to System Settings.
  assert.equal(permissions.tccutilTarget({ mas: true, packaged: true }), null)
})

test('offers each desktop OS only what that OS actually gates', () => {
  const { PERMISSIONS_BY_PLATFORM } = permissions

  // macOS gates the most, through TCC.
  assert.deepEqual(
    PERMISSIONS_BY_PLATFORM.darwin.map((entry) => entry.id),
    ['microphone', 'accessibility', 'input-monitoring'],
  )

  // Windows gates the microphone through its privacy settings, and nothing
  // else veenna touches. There is no prompt to raise and no way to reset, so
  // opening the right Settings page is the whole of what it can offer.
  const windows = PERMISSIONS_BY_PLATFORM.win32
  assert.deepEqual(
    windows.map((entry) => entry.id),
    ['microphone'],
  )
  assert.equal(windows[0].canRequest, false)
  assert.equal(windows[0].tccService, undefined)
  assert.ok(windows[0].pane.startsWith('ms-settings:'))

  // Linux leaves all of it to the session and its portals.
  assert.deepEqual(PERMISSIONS_BY_PLATFORM.linux, [])
})

test('only macOS claims it can put a grant back to never-asked', () => {
  const { PERMISSIONS_BY_PLATFORM } = permissions
  assert.ok(PERMISSIONS_BY_PLATFORM.darwin.every((entry) => entry.tccService))
  assert.ok(PERMISSIONS_BY_PLATFORM.win32.every((entry) => !entry.tccService))
})

test('every permission says what it is for and whether it can be acted on', () => {
  for (const list of Object.values(permissions.PERMISSIONS_BY_PLATFORM)) {
    for (const entry of list) {
      assert.ok(entry.id, 'needs an id')
      assert.ok(entry.label, `${entry.id} needs a label`)
      assert.ok(entry.purpose, `${entry.id} needs a purpose the user can read`)
      // Somewhere to send them by hand is the one thing every OS can do.
      assert.ok(entry.pane, `${entry.id} needs a settings pane`)
    }
  }
})

test('does not claim it can prompt for the ones macOS has no prompt for', () => {
  // Reads the macOS table by name, not the running platform's, so this says the
  // same thing however the tests are run.
  const byId = new Map(permissions.PERMISSIONS_BY_PLATFORM.darwin.map((entry) => [entry.id, entry]))
  // Input monitoring has no API at all. A button offering to ask would be a lie.
  assert.equal(byId.get('input-monitoring').canRequest, false)
  assert.equal(byId.get('microphone').canRequest, true)
  assert.equal(byId.get('accessibility').canRequest, true)
})

test('refuses an id it does not know rather than resetting something else', async () => {
  assert.deepEqual(await permissions.resetPermission('everything'), {
    ok: false,
    reason: 'unknown_permission',
  })
  assert.deepEqual(await permissions.requestPermission(''), {
    ok: false,
    reason: 'unknown_permission',
  })
})

test('a reset runs tccutil for that one service and bundle', async (t) => {
  if (process.platform !== 'darwin') {
    t.skip('macOS only')
    return
  }
  const original = childProcess.execFile
  const calls = []
  childProcess.execFile = (file, args, _opts, done) => {
    calls.push([file, ...args])
    done(null, '', '')
  }

  try {
    const result = await permissions.resetPermission('microphone')
    assert.equal(result.ok, true)
    // Nobody should be asked to restart the app to see their own click land.
    assert.equal(result.needsRestart, undefined)
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], 'tccutil')
    assert.equal(calls[0][1], 'reset')
    assert.equal(calls[0][2], 'Microphone')
    assert.ok(calls[0][3], 'targets a bundle id')
  } finally {
    childProcess.execFile = original
  }
})

test('every cleared permission reads as cleared straight away, not after a relaunch', async (t) => {
  if (process.platform !== 'darwin') {
    t.skip('macOS only')
    return
  }
  const original = childProcess.execFile
  childProcess.execFile = (_file, _args, _opts, done) => done(null, '', '')

  try {
    // All four probes answer from a per-process cache, so all four keep
    // insisting the grant is still there. Reporting that stale read is what
    // left the row saying "Allowed" right after the user cleared it.
    for (const id of ['microphone', 'accessibility', 'input-monitoring']) {
      const result = await permissions.resetPermission(id)
      assert.equal(result.ok, true, `${id} should clear`)
      assert.equal(result.status, 'not-determined', `${id} should read as cleared`)

      // And it has to survive the next listing, or a refresh walks it back.
      const listed = permissions.listPermissions().permissions.find((row) => row.id === id)
      assert.equal(listed.status, 'not-determined', `${id} should stay cleared on a refresh`)
    }

    // Asking again hands the question back to the system.
    await permissions.requestPermission('accessibility')
    assert.equal(permissions.__clearedIdsForTests.has('accessibility'), false)
    assert.equal(permissions.__clearedIdsForTests.has('microphone'), true)
  } finally {
    childProcess.execFile = original
    permissions.__clearedIdsForTests.clear()
  }
})

test('asking never leaves the button doing nothing at all', async (t) => {
  if (process.platform !== 'darwin') {
    t.skip('macOS only')
    return
  }
  const original = childProcess.execFile
  childProcess.execFile = (_file, _args, _opts, done) => done(null, '', '')

  try {
    // Clearing spends the prompt: this process keeps macOS's cached decision,
    // so askForMediaAccess would return without drawing anything. Asking has to
    // fall through to the pane rather than looking dead.
    await permissions.resetPermission('microphone')
    const afterClear = await permissions.requestPermission('microphone')
    assert.equal(afterClear.promptUnavailable, true)

    // Ones macOS has no prompt for at all take the same route, without ever
    // claiming a prompt was missed.
    const noPrompt = await permissions.requestPermission('input-monitoring')
    assert.equal(noPrompt.promptUnavailable, false)
  } finally {
    childProcess.execFile = original
    permissions.__clearedIdsForTests.clear()
  }
})

test('a refused reset reports the reason instead of claiming success', async (t) => {
  if (process.platform !== 'darwin') {
    t.skip('macOS only')
    return
  }
  const original = childProcess.execFile
  childProcess.execFile = (_file, _args, _opts, done) => {
    done(new Error('exit 1'), '', 'tccutil: Operation not permitted')
  }

  try {
    const result = await permissions.resetPermission('accessibility')
    assert.equal(result.ok, false)
    assert.match(result.reason, /not permitted/i)
    // `opened` reports whether the fallback pane actually came up, rather than
    // pointing the user at a window nobody opened. Outside Electron it cannot.
    assert.equal(result.opened, false)
  } finally {
    childProcess.execFile = original
  }
})
