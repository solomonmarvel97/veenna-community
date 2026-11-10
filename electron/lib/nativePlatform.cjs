'use strict';

const { execFile } = require('child_process');
const { clipboard, nativeImage, systemPreferences } = require('electron');

/** Last non-veenna app seen while capturing foreground - paste fallback when HUD stole focus. */
let lastKnownExternalForeground = null;

/** Lets the parked HUD give up focus. It always gives it up; only how sure we are differs. */
const HUD_RELEASE_MS = 30;
const OSASCRIPT_HUD_RELEASE_MS = 90;
/** Covers the 200 ms the monitor may wait for the target to come forward. */
const NATIVE_PASTE_TIMEOUT_MS = 600;
const NATIVE_FOREGROUND_TIMEOUT_MS = 300;

function execScript(command, args, timeoutMs = 8000) {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: timeoutMs, windowsHide: true }, (error, stdout) => {
      if (error) resolve(null);
      else resolve(String(stdout || '').trim() || null);
    });
  });
}

/** Like execScript but treats empty stdout as success (osascript keystroke has no output). */
function execScriptOk(command, args, timeoutMs = 8000) {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: timeoutMs, windowsHide: true }, (error) => {
      resolve(!error);
    });
  });
}

function escapeForAppleScript(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeForPowerShellSingleQuoted(value) {
  return String(value).replace(/'/g, "''");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Paste clipboard contents into the focused app via platform-specific keystroke simulation.
 * Optionally re-activates the app that had focus when dictation started.
 * @param {string} text
 * @param {{ appName?: string | null, bundleId?: string | null } | null} [target]
 */
function rememberExternalForeground(ctx) {
  if (!ctx || isSelfAppTarget(ctx)) return;
  lastKnownExternalForeground = {
    appName: String(ctx.appName || '').trim() || null,
    bundleId: String(ctx.bundleId || '').trim() || null,
  };
}

function resolvePasteTarget(target, allowFallbackTarget = true) {
  if (isOwnAppPaste(target)) return { intoOwnApp: true };
  if (target && !isSelfAppTarget(target)) return target;
  if (!allowFallbackTarget) return null;
  return lastKnownExternalForeground;
}

function isOwnAppPaste(target) {
  return Boolean(target && typeof target === 'object' && target.intoOwnApp);
}

function writeClipboardText(text) {
  const value = String(text ?? '');
  if (!value) return { ok: false, reason: 'empty' };
  if (value.length > 1_000_000) return { ok: false, reason: 'too_large' };
  clipboard.writeText(value);
  return { ok: true };
}

/** Copy an image to the system clipboard from base64 bytes (PNG/JPEG/WebP/GIF). */
function writeClipboardImage(payload) {
  const base64 = typeof payload?.base64 === 'string' ? payload.base64 : '';
  if (!base64) return { ok: false, reason: 'empty' };
  let buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch {
    return { ok: false, reason: 'invalid_base64' };
  }
  if (!buffer.length) return { ok: false, reason: 'empty' };
  if (buffer.length > 25_000_000) return { ok: false, reason: 'too_large' };
  const image = nativeImage.createFromBuffer(buffer);
  if (!image || image.isEmpty()) return { ok: false, reason: 'invalid_image' };
  clipboard.writeImage(image);
  return { ok: true };
}

async function sendPasteKeystroke() {
  if (process.platform === 'darwin') {
    if (!systemPreferences.isTrustedAccessibilityClient(false)) {
      return { ok: false, reason: 'accessibility_required' };
    }
    const native = await pasteThroughKeyMonitor(null);
    if (native) return native;
    let sent = await execScriptOk('osascript', [
      '-e',
      'tell application "System Events" to keystroke "v" using command down',
    ]);
    if (!sent) {
      await sleep(120);
      sent = await execScriptOk('osascript', [
        '-e',
        'tell application "System Events" to keystroke "v" using command down',
      ]);
    }
    return { ok: sent, reason: sent ? undefined : 'paste_failed' };
  }

  if (process.platform === 'win32') {
    const sent = await execScriptOk('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "$wshell = New-Object -ComObject wscript.shell; $null = $wshell.SendKeys('^v')",
    ]);
    return { ok: sent, reason: sent ? undefined : 'paste_failed' };
  }

  if (process.platform === 'linux') {
    let sent = await execScriptOk('xdotool', ['key', '--clearmodifiers', 'ctrl+v']);
    if (sent) return { ok: true };
    sent = await execScriptOk('ydotool', ['key', '29:1', '47:1', '47:0', '29:0']);
    return { ok: sent, reason: sent ? undefined : 'paste_tool_missing' };
  }

  return { ok: false, reason: 'unsupported_platform' };
}

async function focusOwnMainWindow() {
  try {
    const { focusMainWindow } = require('./notifications.cjs');
    return Boolean(focusMainWindow());
  } catch {
    return false;
  }
}

async function focusOwnAppForPaste() {
  return focusOwnMainWindow();
}

/** Asks the key monitor; null when it can't be asked. Loaded late: it loads Electron windows. */
function nativeCommand(command, timeoutMs) {
  if (process.platform !== 'darwin') return Promise.resolve(null);
  try {
    return require('../dictationHotkeyListener.cjs').macMonitorCommand(command, timeoutMs);
  } catch {
    return Promise.resolve(null);
  }
}

/**
 * Paste through the running key monitor: no process to start, and no fixed waits
 * because it brings the target forward and confirms that before typing.
 * Returns null when nothing was typed and osascript should do it instead. A reply
 * that never comes is a failure, not a retry: the keystroke may have landed.
 */
async function pasteThroughKeyMonitor(pasteTarget) {
  const bundleId = String(pasteTarget?.bundleId || '').trim();
  if (bundleId.includes(' ')) return null;
  const reply = await nativeCommand(bundleId ? `paste ${bundleId}` : 'paste', NATIVE_PASTE_TIMEOUT_MS);
  if (!reply) return null;
  if (reply.ok) return { ok: true };
  if (reply.reason === 'timeout') return { ok: false, reason: 'paste_failed' };
  return null;
}

async function pasteIntoForegroundApp(text, target = null, allowFallbackTarget = true) {
  const value = String(text || '').trim();
  if (!value) return { ok: false, reason: 'empty' };

  const copied = writeClipboardText(value);
  if (!copied.ok) return copied;

  // Keep the floating HUD from receiving ⌘V / becoming frontmost.
  try {
    const { hideOverlay } = require('./overlayWindow.cjs');
    hideOverlay();
  } catch {
    /* overlay module may be unavailable in tests */
  }

  await sleep(HUD_RELEASE_MS);

  if (isOwnAppPaste(target)) {
    await focusOwnAppForPaste();
    await sleep(100);
    return sendPasteKeystroke();
  }

  const pasteTarget = resolvePasteTarget(target, allowFallbackTarget);
  if (!pasteTarget) return { ok: false, reason: 'no_target' };
  if (isOwnAppPaste(pasteTarget)) {
    await focusOwnAppForPaste();
    await sleep(100);
    return sendPasteKeystroke();
  }

  if (process.platform === 'darwin') {
    if (!systemPreferences.isTrustedAccessibilityClient(false)) {
      return { ok: false, reason: 'accessibility_required' };
    }
    const native = await pasteThroughKeyMonitor(pasteTarget);
    if (native) return native;
    await sleep(OSASCRIPT_HUD_RELEASE_MS - HUD_RELEASE_MS);
    await activateDarwinApp(pasteTarget);
    await sleep(100);
    return sendPasteKeystroke();
  }

  if (process.platform === 'win32') {
    await activateWindowsApp(pasteTarget);
    await sleep(100);
    return sendPasteKeystroke();
  }

  if (process.platform === 'linux') {
    return sendPasteKeystroke();
  }

  return { ok: false, reason: 'unsupported_platform' };
}

function isSelfAppTarget(target) {
  if (!target || typeof target !== 'object') return true;
  const appName = String(target.appName || '').trim();
  const bundleId = String(target.bundleId || '').trim();
  if (!appName && !bundleId) return true;
  const hay = `${appName} ${bundleId}`.toLowerCase();
  return (
    /^veenna\.?$/i.test(appName) ||
    /^electron$/i.test(appName) ||
    hay.includes('veenna') ||
    hay.includes('dictation')
  );
}

async function activateDarwinApp(target) {
  if (isSelfAppTarget(target)) return false;
  const bundleId = String(target?.bundleId || '').trim();
  const appName = String(target?.appName || '').trim();

  if (bundleId) {
    const script = [
      'tell application "System Events"',
      `  set matched to every process whose bundle identifier is "${escapeForAppleScript(bundleId)}"`,
      '  if (count of matched) > 0 then',
      '    set frontmost of item 1 of matched to true',
      '    return "ok"',
      '  end if',
      'end tell',
    ].join('\n');
    const ok = await execScript('osascript', ['-e', script]);
    if (ok) return true;
  }

  if (appName) {
    const script = [
      'tell application "System Events"',
      `  set matched to every process whose name is "${escapeForAppleScript(appName)}"`,
      '  if (count of matched) > 0 then',
      '    set frontmost of item 1 of matched to true',
      '    return "ok"',
      '  end if',
      'end tell',
    ].join('\n');
    const ok = await execScript('osascript', ['-e', script]);
    if (ok) return true;
  }

  return false;
}

async function activateWindowsApp(target) {
  if (isSelfAppTarget(target)) return false;
  const appName = String(target?.appName || '').trim();
  if (!appName) return false;
  const script = [
    `$name = '${escapeForPowerShellSingleQuoted(appName)}'`,
    '$procs = Get-Process | Where-Object { $_.MainWindowTitle -ne "" -and $_.ProcessName -like "*$name*" } | Select-Object -First 1',
    'if (-not $procs) { $procs = Get-Process | Where-Object { $_.ProcessName -eq $name } | Select-Object -First 1 }',
    'if ($procs) {',
    "  Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class WinFocus { [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd); }'",
    '  [void][WinFocus]::SetForegroundWindow($procs.MainWindowHandle)',
    "  'ok'",
    '}',
  ].join('; ');
  const ok = await execScript('powershell', ['-NoProfile', '-NonInteractive', '-Command', script]);
  return Boolean(ok);
}

const FOREGROUND_TEXT_INPUT_SCRIPT = [
  'tell application "System Events"',
  '  set proc to first application process whose frontmost is true',
  '  set focused to missing value',
  '  try',
  '    set focused to value of attribute "AXFocusedUIElement" of proc',
  '  end try',
  '  if focused is missing value then return "no"',
  '  repeat 16 times',
  '    try',
  '      set role to value of attribute "AXRole" of focused',
  '      if role is "AXTextArea" or role is "AXTextField" or role is "AXSearchField" or role is "AXComboBox" or role is "AXWebArea" or role is "AXTextView" then return "yes"',
  '      try',
  '        if (value of attribute "AXEditable" of focused) is true then return "yes"',
  '      end try',
  '      try',
  '        set subrole to value of attribute "AXSubrole" of focused',
  '        if subrole is "AXSecureTextFieldSubrole" or subrole is "AXSearchFieldSubrole" then return "yes"',
  '      end try',
  '      if role is "AXScrollArea" or role is "AXGroup" then',
  '        try',
  '          set axDesc to (value of attribute "AXDescription" of focused) as text',
  '          if axDesc contains "editor" or axDesc contains "Editor" or axDesc contains "code" or axDesc contains "source" or axDesc contains "terminal" then return "yes"',
  '        end try',
  '        try',
  '          set axHelp to (value of attribute "AXHelp" of focused) as text',
  '          if axHelp contains "editor" or axHelp contains "Editor" then return "yes"',
  '        end try',
  '      end if',
  '      try',
  '        set focused to value of attribute "AXParent" of focused',
  '      on error',
  '        exit repeat',
  '      end try',
  '    on error',
  '      exit repeat',
  '    end try',
  '  end repeat',
  'end tell',
  'return "no"',
].join('\n');

async function isForegroundTextInputFocusedDarwin() {
  if (!systemPreferences.isTrustedAccessibilityClient(false)) {
    return false;
  }

  const result = await execScript('osascript', ['-e', FOREGROUND_TEXT_INPUT_SCRIPT]);
  return result === 'yes';
}

async function isForegroundTextInputFocused() {
  if (process.platform === 'darwin') return isForegroundTextInputFocusedDarwin();
  // Unknown on other platforms - caller treats false as "no confirmed text target".
  return false;
}

async function getForegroundAppNameDarwin() {
  const ctx = await getForegroundContextDarwin();
  return ctx?.appName ?? null;
}

async function getForegroundContextDarwin() {
  const native = await nativeCommand('foreground', NATIVE_FOREGROUND_TIMEOUT_MS);
  if (native?.ok && native.appName) {
    return {
      appName: native.appName,
      bundleId: native.bundleId || null,
      windowTitle: native.windowTitle || null,
      textInputFocused: Boolean(native.textInputFocused),
    };
  }

  const script = [
    'tell application "System Events"',
    '  set frontApp to first application process whose frontmost is true',
    '  set appName to name of frontApp',
    '  set bundleId to ""',
    '  set windowTitle to ""',
    '  try',
    '    set bundleId to bundle identifier of frontApp',
    '  end try',
    '  try',
    '    if (count of windows of frontApp) > 0 then',
    '      set windowTitle to name of front window of frontApp',
    '    end if',
    '  end try',
    '  return appName & linefeed & bundleId & linefeed & windowTitle',
    'end tell',
  ].join('\n');

  const raw = await execScript('osascript', ['-e', script]);
  if (!raw) return null;

  const [appName, bundleId, windowTitle] = raw.split('\n');
  const name = String(appName || '').trim();
  if (!name) return null;

  const textInputFocused = await isForegroundTextInputFocusedDarwin();

  return {
    appName: name,
    bundleId: String(bundleId || '').trim() || null,
    windowTitle: String(windowTitle || '').trim() || null,
    textInputFocused,
  };
}

async function getForegroundAppNameWindows() {
  const ctx = await getForegroundContextWindows();
  return ctx?.appName ?? null;
}

async function getForegroundContextWindows() {
  const script = [
    'Add-Type @\"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'using System.Text;',
    'public class ForegroundWin32 {',
    '  [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow();',
    '  [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);',
    '  [DllImport(\"user32.dll\", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);',
    '}',
    '\"@',
    '$hwnd = [ForegroundWin32]::GetForegroundWindow()',
    '$pid = 0',
    '[ForegroundWin32]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null',
    '$processName = \"\"',
    'if ($pid -gt 0) { $processName = (Get-Process -Id $pid -ErrorAction SilentlyContinue).ProcessName }',
    '$titleBuilder = New-Object System.Text.StringBuilder 512',
    '[ForegroundWin32]::GetWindowText($hwnd, $titleBuilder, 512) | Out-Null',
    '$title = $titleBuilder.ToString()',
    'Write-Output ($processName + [Environment]::NewLine + $title)',
  ].join('; ');

  const raw = await execScript('powershell', ['-NoProfile', '-NonInteractive', '-Command', script]);
  if (!raw) return null;

  const [appName, windowTitle] = raw.split(/\r?\n/);
  const name = String(appName || '').trim();
  if (!name) return null;

  return {
    appName: name,
    bundleId: null,
    windowTitle: String(windowTitle || '').trim() || null,
    textInputFocused: false,
  };
}

async function getForegroundAppNameLinux() {
  const ctx = await getForegroundContextLinux();
  return ctx?.appName ?? null;
}

async function getForegroundContextLinux() {
  const wmClass = await execScript('xdotool', ['getactivewindow', 'getwindowclassname']);
  const wmName =
    (await execScript('xdotool', ['getactivewindow', 'getwindowname']))
    || (await execScript('bash', ['-lc', "xdotool getwindowfocus getwindowname 2>/dev/null || true"]));

  const appName = wmClass ? wmClass.split(',')[0]?.trim() || wmClass : wmName;
  if (!appName) return null;

  return {
    appName,
    bundleId: null,
    windowTitle: wmName && wmName !== appName ? wmName : null,
    textInputFocused: false,
  };
}

async function getForegroundAppName() {
  if (process.platform === 'darwin') return getForegroundAppNameDarwin();
  if (process.platform === 'win32') return getForegroundAppNameWindows();
  if (process.platform === 'linux') return getForegroundAppNameLinux();
  return null;
}

async function getForegroundContext() {
  let ctx = null;
  if (process.platform === 'darwin') ctx = await getForegroundContextDarwin();
  else if (process.platform === 'win32') ctx = await getForegroundContextWindows();
  else if (process.platform === 'linux') ctx = await getForegroundContextLinux();
  if (ctx) rememberExternalForeground(ctx);
  return ctx;
}

module.exports = {
  writeClipboardText,
  writeClipboardImage,
  pasteIntoForegroundApp,
  getForegroundAppName,
  getForegroundContext,
  escapeForAppleScript,
  escapeForPowerShellSingleQuoted,
};
