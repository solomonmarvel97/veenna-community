import ApplicationServices
import Carbon.HIToolbox
import Cocoa
import CoreGraphics
import Foundation

// Option (left or right):
//   hold = push-to-talk
//   press twice = hands-free
//   while hands-free: another Option press confirms (same as ✓)
let optionKeyCodes: Set<Int64> = [58, 61]
/// Globe / Fn on Apple keyboards - stop hands-free like Option confirm.
let globeKeyCodes: Set<Int64> = [63, 179]
let cgHIDEventTap = CGEventTapLocation(rawValue: 0)!

var optionHeld = false
var leftOptionHeld = false
var rightOptionHeld = false
var sessionEngaged = false
var handsFreeLatched = false
var eventTap: CFMachPort?
var consumeEvents = false
var inputMonitoringGranted = false

// Clio Screen chord: a set of modifiers held together with nothing else (default Control+Option).
// Control must already be down when Option goes down, so Option alone stays dictation.
var clioMask: CGEventFlags = [.maskShift]
var clioHeld = false

// Key chord mode (default Shift+Space): a modifier plus the space bar. The space is swallowed so it
// never types; held for 200 ms it starts Clio, and a shorter press types the space after all.
var clioKeyMode = true
let spaceKeyCode: Int64 = 49
var clioPending = false
var clioPendingTimer: Timer?
let clioHoldDelay = 0.2

func postSpaceKeystroke(withShift: Bool) {
    guard let source = CGEventSource(stateID: .combinedSessionState),
        let down = CGEvent(keyboardEventSource: source, virtualKey: CGKeyCode(spaceKeyCode), keyDown: true),
        let up = CGEvent(keyboardEventSource: source, virtualKey: CGKeyCode(spaceKeyCode), keyDown: false)
    else { return }
    let flags: CGEventFlags = withShift ? .maskShift : []
    down.flags = flags
    up.flags = flags
    down.post(tap: .cgSessionEventTap)
    up.post(tap: .cgSessionEventTap)
}

func clioKeyCancelPending() {
    clioPendingTimer?.invalidate()
    clioPendingTimer = nil
    clioPending = false
}
let clioRelevant: CGEventFlags = [.maskControl, .maskAlternate, .maskShift, .maskCommand]

func clioChordActive(_ flags: CGEventFlags) -> Bool {
    flags.intersection(clioRelevant) == clioMask
}

func updateClioChord(_ flags: CGEventFlags) {
    let active = clioChordActive(flags)
    if active && !clioHeld {
        // Dictation already running (Option first, then Control): it keeps the key.
        if sessionEngaged || handsFreeLatched { return }
        clioHeld = true
        emit("clio-down")
    } else if !active && clioHeld {
        clioHeld = false
        emit("clio-up")
    }
}

/// Option going down while the Clio chord (which includes Option) is complete is not dictation.
func clioClaimsOption(_ flags: CGEventFlags) -> Bool {
    !clioKeyMode && clioMask.contains(.maskAlternate) && clioChordActive(flags)
}

func parseClioChord(_ text: String) -> CGEventFlags? {
    var mask: CGEventFlags = []
    for word in text.split(separator: "+") {
        switch word {
        case "control": mask.insert(.maskControl)
        case "option": mask.insert(.maskAlternate)
        case "shift": mask.insert(.maskShift)
        case "command": mask.insert(.maskCommand)
        default: return nil
        }
    }
    return mask.isEmpty ? nil : mask
}

func emit(_ action: String) {
    let payload = "{\"action\":\"\(action)\"}\n"
    if let data = payload.data(using: .utf8) {
        FileHandle.standardOutput.write(data)
    }
}

func resetSession(emitUpEvent: Bool) {
    let wasEngaged = sessionEngaged || handsFreeLatched
    sessionEngaged = false
    handsFreeLatched = false
    if emitUpEvent, wasEngaged {
        emit("up")
    }
}

func handleOptionDown() {
    if optionHeld { return }
    optionHeld = true

    if handsFreeLatched {
        emit("confirm")
        resetSession(emitUpEvent: false)
        return
    }

    if !sessionEngaged {
        sessionEngaged = true
        emit("down")
    }
}

func handleOptionUp() {
    guard optionHeld else { return }
    optionHeld = false

    if handsFreeLatched {
        return
    }

    guard sessionEngaged else { return }
    resetSession(emitUpEvent: true)
}

func handleOptionComboInterrupt() {
    guard optionHeld, sessionEngaged, !handsFreeLatched else { return }
    resetSession(emitUpEvent: true)
}

func anyOptionPhysicallyHeld() -> Bool {
    leftOptionHeld || rightOptionHeld
}

func isOptionKey(_ keycode: Int64) -> Bool {
    optionKeyCodes.contains(keycode)
}

func handleOptionFlagsChanged(_ event: CGEvent) {
    let keycode = event.getIntegerValueField(.keyboardEventKeycode)
    guard isOptionKey(keycode) else { return }
    let isDown = event.flags.contains(.maskAlternate)

    if keycode == 58 {
        if isDown && !leftOptionHeld {
            leftOptionHeld = true
            if !optionHeld && !clioClaimsOption(event.flags) { handleOptionDown() }
        } else if !isDown && leftOptionHeld {
            leftOptionHeld = false
            if optionHeld && !anyOptionPhysicallyHeld() { handleOptionUp() }
        }
    } else if keycode == 61 {
        if isDown && !rightOptionHeld {
            rightOptionHeld = true
            if !optionHeld && !clioClaimsOption(event.flags) { handleOptionDown() }
        } else if !isDown && rightOptionHeld {
            rightOptionHeld = false
            if optionHeld && !anyOptionPhysicallyHeld() { handleOptionUp() }
        }
    }
}

func callback(
    proxy: CGEventTapProxy,
    type: CGEventType,
    event: CGEvent,
    refcon: UnsafeMutableRawPointer?
) -> Unmanaged<CGEvent>? {
    if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
        if let tap = eventTap {
            CGEvent.tapEnable(tap: tap, enable: true)
        }
        return Unmanaged.passUnretained(event)
    }

    if clioKeyMode {
        let keycode = event.getIntegerValueField(.keyboardEventKeycode)
        let flags = event.flags
        let shiftOnly = flags.intersection(clioRelevant) == clioMask
        if type == .keyDown && keycode == spaceKeyCode {
            if event.getIntegerValueField(.keyboardEventAutorepeat) != 0 {
                if clioPending || clioHeld { return consumeEvents ? nil : Unmanaged.passUnretained(event) }
            } else if consumeEvents && shiftOnly && !sessionEngaged && !handsFreeLatched {
                clioPending = true
                clioPendingTimer?.invalidate()
                clioPendingTimer = Timer.scheduledTimer(withTimeInterval: clioHoldDelay, repeats: false) { _ in
                    guard clioPending else { return }
                    clioPending = false
                    clioHeld = true
                    emit("clio-down")
                }
                return nil
            }
        } else if type == .keyUp && keycode == spaceKeyCode && (clioPending || clioHeld) {
            if clioPending {
                // Too short to be a question: it was just a space.
                clioKeyCancelPending()
                postSpaceKeystroke(withShift: true)
            } else {
                clioHeld = false
                emit("clio-up")
            }
            return nil
        } else if type == .flagsChanged && !flags.contains(.maskShift) {
            if clioPending {
                clioKeyCancelPending()
                postSpaceKeystroke(withShift: false)
            } else if clioHeld {
                clioHeld = false
                emit("clio-up")
            }
        } else if type == .keyDown && (clioPending || clioHeld) {
            // Another key with the chord down: a shortcut, not Clio.
            if clioPending {
                clioKeyCancelPending()
                postSpaceKeystroke(withShift: true)
            } else {
                clioHeld = false
                emit("clio-cancel")
            }
        }
    }

    if type == .flagsChanged {
        // The chord is judged first so a claimed Option never starts dictation.
        let keycode = event.getIntegerValueField(.keyboardEventKeycode)
        if !clioKeyMode && isOptionKey(keycode) && event.flags.contains(.maskAlternate) { updateClioChord(event.flags) }
        handleOptionFlagsChanged(event)
        if !clioKeyMode && !(isOptionKey(keycode) && event.flags.contains(.maskAlternate)) { updateClioChord(event.flags) }
    }

    if type == .keyDown {
        let keycode = event.getIntegerValueField(.keyboardEventKeycode)
        if globeKeyCodes.contains(keycode) {
            if handsFreeLatched || sessionEngaged {
                emit("confirm")
                resetSession(emitUpEvent: false)
                if consumeEvents {
                    return nil
                }
            }
        }
        // Any other key while the chord is down means it was a shortcut, not Clio.
        if clioHeld && !clioKeyMode {
            clioHeld = false
            emit("clio-cancel")
        }
        if anyOptionPhysicallyHeld(), !isOptionKey(keycode) {
            handleOptionComboInterrupt()
        }
    }

    return Unmanaged.passUnretained(event)
}

let eventMask: CGEventMask =
    (1 << CGEventType.flagsChanged.rawValue)
    | (1 << CGEventType.keyDown.rawValue)
    | (1 << CGEventType.keyUp.rawValue)
    | (1 << CGEventType.tapDisabledByTimeout.rawValue)
    | (1 << CGEventType.tapDisabledByUserInput.rawValue)

func createTap(location: CGEventTapLocation, options: CGEventTapOptions) -> CFMachPort? {
    CGEvent.tapCreate(
        tap: location,
        place: .headInsertEventTap,
        options: options,
        eventsOfInterest: eventMask,
        callback: callback,
        userInfo: nil
    )
}

// Paste and the foreground lookup run here because this process is already up:
// asking macOS through osascript starts a new process each time, which is most
// of a second per dictation. One command per line on stdin, one JSON reply per
// line on stdout, matched by id:
//   <id> foreground
//   <id> paste [bundle id to bring forward first]

func replyLine(_ id: String, _ fields: [String: Any]) {
    var payload = fields
    payload["reply"] = id
    guard var data = try? JSONSerialization.data(withJSONObject: payload) else { return }
    data.append(0x0A)
    FileHandle.standardOutput.write(data)
}

/// The key that types "v" on this keyboard layout; Dvorak moves it from the QWERTY spot.
func keyCodeForV() -> CGKeyCode {
    let qwertyV: CGKeyCode = 9
    guard
        let source = TISCopyCurrentKeyboardLayoutInputSource()?.takeRetainedValue(),
        let raw = TISGetInputSourceProperty(source, kTISPropertyUnicodeKeyLayoutData)
    else { return qwertyV }
    let data = Unmanaged<CFData>.fromOpaque(raw).takeUnretainedValue() as Data
    return data.withUnsafeBytes { bytes -> CGKeyCode in
        guard let layout = bytes.bindMemory(to: UCKeyboardLayout.self).baseAddress else { return qwertyV }
        for code in UInt16(0)..<UInt16(128) {
            var deadKeys: UInt32 = 0
            var chars = [UniChar](repeating: 0, count: 4)
            var length = 0
            let status = UCKeyTranslate(
                layout, code, UInt16(kUCKeyActionDisplay), 0, UInt32(LMGetKbdType()),
                OptionBits(kUCKeyTranslateNoDeadKeysBit), &deadKeys, chars.count, &length, &chars)
            if status == noErr, length == 1, chars[0] == 0x76 { return CGKeyCode(code) }
        }
        return qwertyV
    }
}

func postPasteKeystroke() -> Bool {
    guard let source = CGEventSource(stateID: .combinedSessionState) else { return false }
    let key = keyCodeForV()
    guard
        let down = CGEvent(keyboardEventSource: source, virtualKey: key, keyDown: true),
        let up = CGEvent(keyboardEventSource: source, virtualKey: key, keyDown: false)
    else { return false }
    // Set outright: a modifier still held down must not turn this into another shortcut.
    down.flags = .maskCommand
    up.flags = .maskCommand
    down.post(tap: .cgSessionEventTap)
    up.post(tap: .cgSessionEventTap)
    return true
}

/// Brings the app forward and waits until macOS agrees, or says it could not.
func bringForward(_ bundleId: String, then done: @escaping (Bool) -> Void) {
    if NSWorkspace.shared.frontmostApplication?.bundleIdentifier == bundleId {
        done(true)
        return
    }
    guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first
    else {
        done(false)
        return
    }
    app.activate(options: [])
    var attempts = 0
    Timer.scheduledTimer(withTimeInterval: 0.01, repeats: true) { timer in
        attempts += 1
        let front = NSWorkspace.shared.frontmostApplication?.bundleIdentifier == bundleId
        guard front || attempts >= 20 else { return }
        timer.invalidate()
        done(front)
    }
}

func axValue(_ element: AXUIElement, _ attribute: String) -> AnyObject? {
    var value: AnyObject?
    guard AXUIElementCopyAttributeValue(element, attribute as CFString, &value) == .success else {
        return nil
    }
    return value
}

func axElement(_ element: AXUIElement, _ attribute: String) -> AXUIElement? {
    guard let value = axValue(element, attribute), CFGetTypeID(value) == AXUIElementGetTypeID()
    else { return nil }
    return unsafeBitCast(value, to: AXUIElement.self)
}

let textRoles: Set<String> = [
    "AXTextArea", "AXTextField", "AXSearchField", "AXComboBox", "AXWebArea", "AXTextView",
]
let textSubroles: Set<String> = ["AXSecureTextFieldSubrole", "AXSearchFieldSubrole"]
let editorWords = ["editor", "Editor", "code", "source", "terminal"]

/// Whether keyboard focus sits in something that takes text, walking up from the
/// focused element: the same test `FOREGROUND_TEXT_INPUT_SCRIPT` runs in osascript.
func isTextInputFocused(_ app: AXUIElement) -> Bool {
    guard var element = axElement(app, kAXFocusedUIElementAttribute) else { return false }
    for _ in 0..<16 {
        let role = axValue(element, kAXRoleAttribute) as? String ?? ""
        if textRoles.contains(role) { return true }
        if axValue(element, "AXEditable") as? Bool == true { return true }
        if let subrole = axValue(element, kAXSubroleAttribute) as? String,
            textSubroles.contains(subrole)
        {
            return true
        }
        if role == "AXScrollArea" || role == "AXGroup" {
            let description = axValue(element, kAXDescriptionAttribute) as? String ?? ""
            let help = axValue(element, kAXHelpAttribute) as? String ?? ""
            if editorWords.contains(where: { description.contains($0) || help.contains($0) }) {
                return true
            }
        }
        guard let parent = axElement(element, kAXParentAttribute) else { break }
        element = parent
    }
    return false
}

func handleCommand(_ line: String) {
    let parts = line.split(separator: " ").map(String.init)
    guard parts.count >= 2 else { return }
    let id = parts[0]

    if parts[1] == "clio-chord", parts.count >= 3 {
        if parts[2].hasSuffix("+space"), let mask = parseClioChord(String(parts[2].dropLast(6))) {
            clioMask = mask
            clioKeyMode = true
            clioKeyCancelPending()
            replyLine(id, ["ok": true])
        } else if let mask = parseClioChord(parts[2]) {
            clioKeyMode = false
            clioMask = mask
            replyLine(id, ["ok": true])
        } else {
            replyLine(id, ["ok": false, "reason": "bad_chord"])
        }
        return
    }

    if parts[1] == "paste" {
        guard AXIsProcessTrusted() else {
            replyLine(id, ["ok": false, "reason": "untrusted"])
            return
        }
        guard parts.count >= 3 else {
            replyLine(id, ["ok": postPasteKeystroke()])
            return
        }
        bringForward(parts[2]) { front in
            guard front else {
                replyLine(id, ["ok": false, "reason": "not_frontmost"])
                return
            }
            replyLine(id, ["ok": postPasteKeystroke()])
        }
        return
    }

    if parts[1] == "foreground" {
        guard AXIsProcessTrusted(), let front = NSWorkspace.shared.frontmostApplication else {
            replyLine(id, ["ok": false, "reason": "untrusted"])
            return
        }
        let app = AXUIElementCreateApplication(front.processIdentifier)
        // A stuck app must not hold up dictation: Electron falls back to osascript.
        AXUIElementSetMessagingTimeout(app, 0.15)
        let window = axElement(app, kAXFocusedWindowAttribute)
        replyLine(id, [
            "ok": true,
            "appName": front.localizedName ?? "",
            "bundleId": front.bundleIdentifier ?? "",
            "windowTitle": window.flatMap { axValue($0, kAXTitleAttribute) as? String } ?? "",
            "textInputFocused": isTextInputFocused(app),
        ])
    }
}

var stdinBuffer = Data()
FileHandle.standardInput.readabilityHandler = { handle in
    let chunk = handle.availableData
    // Stdin closes when Veenna does; this helper has no one left to work for.
    if chunk.isEmpty { exit(0) }
    DispatchQueue.main.async {
        stdinBuffer.append(chunk)
        while let end = stdinBuffer.firstIndex(of: 0x0A) {
            let line = String(decoding: stdinBuffer[stdinBuffer.startIndex..<end], as: UTF8.self)
            stdinBuffer.removeSubrange(stdinBuffer.startIndex...end)
            handleCommand(line)
        }
    }
}

// Permission changes are always initiated from Veenna's settings UI. Asking
// from this background helper at launch can force a macOS administrator prompt
// before the person has even chosen to use dictation, and it creates a second
// TCC entry for the helper. We only inspect the optional listen-only fallback.
inputMonitoringGranted = CGPreflightListenEventAccess()

var tap = createTap(location: cgHIDEventTap, options: .defaultTap)
if tap == nil {
    tap = createTap(location: CGEventTapLocation(rawValue: 1)!, options: .defaultTap)
}
if tap != nil {
    consumeEvents = true
} else {
    tap = createTap(location: cgHIDEventTap, options: .listenOnly)
    if tap == nil {
        tap = createTap(location: CGEventTapLocation(rawValue: 1)!, options: .listenOnly)
    }
    consumeEvents = false
}

guard let resolvedTap = tap else {
    FileHandle.standardError.write("{\"error\":\"tap_failed\"}\n".data(using: .utf8)!)
    if inputMonitoringGranted && AXIsProcessTrusted() { exit(1) }
    // No tap yet because a permission is missing. Wait for it rather than
    // leaving Option dead; exit 0 tells the app to start a fresh monitor.
    let waitForGrant = Timer(timeInterval: 2.0, repeats: true) { _ in
        if CGPreflightListenEventAccess() || AXIsProcessTrusted() { exit(0) }
    }
    RunLoop.current.add(waitForGrant, forMode: .common)
    CFRunLoopRun()
    exit(1)
}

eventTap = resolvedTap
let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, resolvedTap, 0)
CFRunLoopAddSource(CFRunLoopGetCurrent(), source, .commonModes)
CGEvent.tapEnable(tap: resolvedTap, enable: true)

// A key-up can go missing: a permission prompt or a secure input field takes
// the event before the tap sees it. Push-to-talk would then hold forever, so
// while Option counts as held, check the key itself and let go when it is up.
let heldCheck = Timer(timeInterval: 0.1, repeats: true) { _ in
    if clioHeld {
        let flags = CGEventSource.flagsState(.hidSystemState)
        let stillHeld = clioKeyMode
            ? (flags.contains(.maskShift) && CGEventSource.keyState(.hidSystemState, key: CGKeyCode(spaceKeyCode)))
            : clioChordActive(flags)
        if !stillHeld {
            clioHeld = false
            emit("clio-up")
        }
    }
    guard optionHeld, !handsFreeLatched else { return }
    let flags = CGEventSource.flagsState(.hidSystemState)
    if flags.contains(.maskAlternate) { return }
    leftOptionHeld = false
    rightOptionHeld = false
    handleOptionUp()
}
RunLoop.current.add(heldCheck, forMode: .common)

// macOS reads Input Monitoring and Accessibility when the tap is created, so a
// grant given afterwards never reaches this process. When one arrives, exit and
// let the app start a fresh monitor that has it, instead of the Option key
// staying dead until veenna is quit.
let startedTrusted = AXIsProcessTrusted()
if !inputMonitoringGranted || !startedTrusted {
    let grantCheck = Timer(timeInterval: 2.0, repeats: true) { _ in
        let gainedInput = !inputMonitoringGranted && CGPreflightListenEventAccess()
        let gainedTrust = !startedTrusted && AXIsProcessTrusted()
        guard gainedInput || gainedTrust else { return }
        if optionHeld && !handsFreeLatched { resetSession(emitUpEvent: true) }
        FileHandle.standardError.write("{\"restart\":\"permission_granted\"}\n".data(using: .utf8)!)
        exit(0)
    }
    RunLoop.current.add(grantCheck, forMode: .common)
}

let ready =
    "{\"ready\":true,\"key\":\"Option\",\"consume\":\(consumeEvents),\"inputMonitoring\":\(inputMonitoringGranted),\"commands\":true,\"clio\":true}\n"
FileHandle.standardError.write(ready.data(using: .utf8)!)
CFRunLoopRun()
