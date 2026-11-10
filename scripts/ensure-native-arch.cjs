'use strict'

/**
 * Make sure the native modules Electron loads were built for this Mac's CPU, and rebuild the
 * ones that were not. A desktop build that targets x64 as well as arm64 (electron:build:*)
 * can leave an x64 binary in node_modules, and Electron on Apple silicon then fails to open
 * the local store with ERR_DLOPEN_FAILED ("incompatible architecture"). Runs before
 * electron:dev; does nothing off macOS or when every binary already matches.
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
const MODULES = [
  { name: 'better-sqlite3', file: 'build/Release/better_sqlite3.node' },
  { name: 'node-pty', file: 'build/Release/pty.node' },
  { name: 'uiohook-napi', file: 'build/Release/uiohook_napi.node' },
]

const CPU_ARM64 = 0x0100000c
const CPU_X64 = 0x01000007
const MACHO_64_LE = 0xfeedfacf

/** The arch a Mach-O file was built for: 'arm64', 'x64', or null when unknown (fat, missing, other). */
function machoArch(file) {
  let fd
  try {
    fd = fs.openSync(file, 'r')
    const head = Buffer.alloc(8)
    fs.readSync(fd, head, 0, 8, 0)
    if (head.readUInt32LE(0) !== MACHO_64_LE) return null
    const cpu = head.readUInt32LE(4)
    if (cpu === CPU_ARM64) return 'arm64'
    if (cpu === CPU_X64) return 'x64'
    return null
  } catch {
    return null
  } finally {
    if (fd !== undefined) fs.closeSync(fd)
  }
}

/** The CPU of the machine, not of this process: an x64 Node under Rosetta still reports x64. */
function hostArch() {
  const probe = spawnSync('sysctl', ['-n', 'hw.optional.arm64'], { encoding: 'utf8' })
  if (probe.status === 0 && probe.stdout.trim() === '1') return 'arm64'
  return os.arch() === 'arm64' ? 'arm64' : 'x64'
}

function main() {
  if (process.platform !== 'darwin') return
  const want = hostArch()
  const stale = MODULES.filter((mod) => {
    const have = machoArch(path.join(ROOT, 'node_modules', mod.name, mod.file))
    return have !== null && have !== want
  })
  if (!stale.length) return

  const names = stale.map((mod) => mod.name)
  console.log(`[native] ${names.join(', ')} built for the wrong CPU; rebuilding for ${want}`)
  const rebuild = path.join(ROOT, 'node_modules', '.bin', 'electron-rebuild')
  const result = spawnSync(rebuild, ['-f', '-o', names.join(','), `--arch=${want}`], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    console.error(`[native] rebuild failed. Run: bunx @electron/rebuild -f -w ${names.join(',')} --arch=${want}`)
    process.exit(result.status || 1)
  }
}

if (require.main === module) main()

module.exports = { machoArch, hostArch }
