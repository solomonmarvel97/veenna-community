#!/usr/bin/env node
'use strict'

/**
 * Builds the on-device dictation helper the desktop app ships, so guest
 * dictation runs on the GPU instead of one CPU thread.
 *
 *   build/whisper-bundle/<os>-<arch>/bin/veenna-whisper(.exe)   the helper
 *   build/whisper-bundle/<os>-<arch>/NOTICES.txt                whisper.cpp's MIT licence
 *
 * <os> is mac, win or linux, as electron-builder names them, so its
 * ${os}-${arch} macros copy the right folder to resources/whisper.
 * The source is whisper.cpp at a pinned tag, checked against the pinned commit
 * before it is built (electron/native/veenna-whisper wraps it).
 *
 * macOS builds must succeed. Elsewhere a failed build leaves the folder empty
 * and the app transcribes with the bundled ONNX model instead.
 *
 *   node scripts/prepare-whisper.cjs [--platform darwin|linux|win32] [--arch arm64|x64|arm64,x64]
 */

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const WHISPER_CPP_TAG = 'v1.9.4'
const WHISPER_CPP_COMMIT = '927cfce34f31707e17f2bff35c349632fb9e2c3a'
const WHISPER_CPP_REPO = 'https://github.com/ggml-org/whisper.cpp'
const ROOT = path.resolve(__dirname, '..')
const SOURCE_DIR = path.join(ROOT, 'build', 'whisper-src', WHISPER_CPP_TAG)
const HELPER_DIR = path.join(ROOT, 'electron', 'native', 'veenna-whisper')
const BUNDLE_ROOT = path.join(ROOT, 'build', 'whisper-bundle')
const OS_NAMES = { darwin: 'mac', win32: 'win', linux: 'linux' }
const MAC_ARCHS = { arm64: 'arm64', x64: 'x86_64' }
/** Matches Electron's own minimum. */
const MAC_DEPLOYMENT_TARGET = '12.0'

function bundleDir(platform, arch) {
  return path.join(BUNDLE_ROOT, `${OS_NAMES[platform] || platform}-${arch}`)
}

function exeName(platform) {
  return platform === 'win32' ? 'veenna-whisper.exe' : 'veenna-whisper'
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.status ?? result.error?.message})`)
  }
}

function headCommit() {
  const result = spawnSync('git', ['-C', SOURCE_DIR, 'rev-parse', 'HEAD'], { encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : null
}

function ensureSource() {
  if (headCommit() === WHISPER_CPP_COMMIT) return
  fs.rmSync(SOURCE_DIR, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(SOURCE_DIR), { recursive: true })
  console.log(`[whisper] fetching whisper.cpp ${WHISPER_CPP_TAG}`)
  run('git', ['clone', '--quiet', '--depth', '1', '--branch', WHISPER_CPP_TAG, WHISPER_CPP_REPO, SOURCE_DIR])
  const commit = headCommit()
  if (commit !== WHISPER_CPP_COMMIT) {
    fs.rmSync(SOURCE_DIR, { recursive: true, force: true })
    throw new Error(`whisper.cpp ${WHISPER_CPP_TAG} is ${commit}, expected ${WHISPER_CPP_COMMIT}`)
  }
}

function buildHelper(platform, arch) {
  const out = bundleDir(platform, arch)
  const binary = path.join(out, 'bin', exeName(platform))
  const work = path.join(ROOT, 'build', 'whisper-work', `${OS_NAMES[platform] || platform}-${arch}`)
  const configure = [
    '-S', HELPER_DIR,
    '-B', work,
    '-DCMAKE_BUILD_TYPE=Release',
    `-DWHISPER_CPP_DIR=${SOURCE_DIR}`,
  ]
  if (platform === 'darwin') {
    configure.push(`-DCMAKE_OSX_ARCHITECTURES=${MAC_ARCHS[arch]}`)
    configure.push(`-DCMAKE_OSX_DEPLOYMENT_TARGET=${MAC_DEPLOYMENT_TARGET}`)
  }
  if (platform === 'win32') configure.push('-A', arch === 'arm64' ? 'ARM64' : 'x64')

  console.log(`[whisper] building veenna-whisper for ${platform}/${arch}`)
  run('cmake', configure)
  run('cmake', ['--build', work, '--config', 'Release', '--target', 'veenna-whisper', '--parallel'])

  const built = [path.join(work, exeName(platform)), path.join(work, 'Release', exeName(platform))].find(
    (candidate) => fs.existsSync(candidate),
  )
  if (!built) throw new Error(`veenna-whisper was not produced in ${work}`)
  fs.mkdirSync(path.dirname(binary), { recursive: true })
  fs.copyFileSync(built, binary)
  fs.chmodSync(binary, 0o755)
  fs.copyFileSync(path.join(SOURCE_DIR, 'LICENSE'), path.join(out, 'NOTICES.txt'))
  console.log(`[whisper] ok -> ${binary}`)
}

function parseArgs(argv) {
  const value = (flag) => {
    const index = argv.indexOf(flag)
    return index >= 0 ? argv[index + 1] : null
  }
  return {
    platform: value('--platform') || process.platform,
    archs: (value('--arch') || process.arch).split(',').filter(Boolean),
  }
}

function main() {
  const { platform, archs } = parseArgs(process.argv.slice(2))
  for (const arch of archs) {
    // electron-builder needs the folder even when there is nothing to put in it.
    fs.mkdirSync(bundleDir(platform, arch), { recursive: true })
    if (fs.existsSync(path.join(bundleDir(platform, arch), 'bin', exeName(platform))) && headCommit() === WHISPER_CPP_COMMIT) {
      console.log(`[whisper] already built for ${platform}/${arch}`)
      continue
    }
    try {
      ensureSource()
      buildHelper(platform, arch)
    } catch (error) {
      if (platform === 'darwin') throw error
      console.warn(`[whisper] skipped ${platform}/${arch}: ${error.message}; the app falls back to the ONNX model`)
    }
  }
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error('[whisper] failed', error?.message || error)
    process.exit(1)
  }
}

module.exports = { bundleDir, exeName, WHISPER_CPP_COMMIT, WHISPER_CPP_TAG }
