import CoreGraphics
import Foundation

@_silgen_name("CGSMainConnectionID")
func CGSMainConnectionID() -> UInt32

@_silgen_name("CGSSetWindowCaptureExcludeShape")
func CGSSetWindowCaptureExcludeShape(_ cid: UInt32, _ wid: UInt32, _ region: UnsafeRawPointer?) -> Int32

@_silgen_name("CGRegionCreateWithRect")
func CGRegionCreateWithRect(_ rect: CGRect) -> UnsafeMutableRawPointer?

@_silgen_name("CGRegionRelease")
func CGRegionRelease(_ region: UnsafeMutableRawPointer?)

func usage() {
    fputs("usage: macos-overlay-capture-exclude <window-id> <width> <height> <0|1>\n", stderr)
}

guard CommandLine.arguments.count >= 5 else {
    usage()
    exit(2)
}

guard let windowId = UInt32(CommandLine.arguments[1]),
      let width = Double(CommandLine.arguments[2]),
      let height = Double(CommandLine.arguments[3])
else {
    usage()
    exit(2)
}

let exclude = CommandLine.arguments[4] == "1"
let connection = CGSMainConnectionID()

if exclude {
    let rect = CGRect(x: 0, y: 0, width: width, height: height)
    if let region = CGRegionCreateWithRect(rect) {
        _ = CGSSetWindowCaptureExcludeShape(connection, windowId, region)
        CGRegionRelease(region)
    }
} else {
    _ = CGSSetWindowCaptureExcludeShape(connection, windowId, nil)
}
