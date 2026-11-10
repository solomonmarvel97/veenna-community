'use strict'

/**
 * Removes files the packaged desktop app never loads, so the installer stays
 * small. Runs in afterPack, before signing. Every rule names what it drops and
 * why the app does not need it; a rule only fires when the thing it relies on
 * is shipped.
 */

const fs = require('node:fs')
const path = require('node:path')

function exists(p) {
  return fs.existsSync(p)
}

function sizeOf(p) {
  const stat = fs.lstatSync(p)
  if (!stat.isDirectory()) return stat.size
  let total = 0
  for (const name of fs.readdirSync(p)) total += sizeOf(path.join(p, name))
  return total
}

function listDir(dir) {
  return exists(dir) ? fs.readdirSync(dir) : []
}

/**
 * @param {string} resources  Contents/Resources (mac) or resources (win/linux)
 * @param {{ platform: string, arch: string }} target  Node names: darwin/win32/linux, arm64/x64
 * @returns {{ path: string, bytes: number, reason: string }[]} what would go
 */
function planPrune(resources, { platform, arch }) {
  const modules = path.join(resources, 'app', 'node_modules')
  const plan = []
  const drop = (p, reason) => {
    if (exists(p)) plan.push({ path: p, bytes: sizeOf(p), reason })
  }

  // onnxruntime-node loads one binding: bin/napi-v3/<platform>/<arch>.
  const ortBin = path.join(modules, 'onnxruntime-node', 'bin', 'napi-v3')
  if (exists(path.join(ortBin, platform, arch))) {
    for (const os of listDir(ortBin)) {
      if (os !== platform) drop(path.join(ortBin, os), 'onnxruntime-node binding for another OS')
    }
    for (const cpu of listDir(path.join(ortBin, platform))) {
      if (cpu !== arch) drop(path.join(ortBin, platform, cpu), 'onnxruntime-node binding for another CPU')
    }
  }

  // ONNX runs on WASM in one thread (configureTransformersEnv.cjs: numThreads = 1),
  // with wasmPaths pointing at @xenova/transformers/dist. Its package main is
  // src/transformers.js, so the prebuilt browser bundles in dist are unused too.
  const xenovaDist = path.join(modules, '@xenova', 'transformers', 'dist')
  if (exists(path.join(xenovaDist, 'ort-wasm-simd.wasm'))) {
    for (const name of listDir(xenovaDist)) {
      if (name.endsWith('.wasm') && name.includes('threaded')) {
        drop(path.join(xenovaDist, name), 'multi-thread ONNX WASM (runs single-threaded)')
      } else if (name.startsWith('transformers') && (name.endsWith('.js') || name.endsWith('.map'))) {
        drop(path.join(xenovaDist, name), 'transformers browser bundle (Node loads src/)')
      }
    }
  }

  // Node loads onnxruntime-web through its package main, dist/ort-web.node.js, which
  // needs only onnxruntime-common. The rest of dist is browser bundles and the same
  // WASM files again (transformers' copy is the one used); lib/ is TypeScript source.
  const ortWeb = path.join(modules, 'onnxruntime-web')
  const ortWebMain = 'ort-web.node.js'
  if (exists(path.join(ortWeb, 'dist', ortWebMain)) && exists(path.join(xenovaDist, 'ort-wasm-simd.wasm'))) {
    for (const name of listDir(path.join(ortWeb, 'dist'))) {
      if (name !== ortWebMain) drop(path.join(ortWeb, 'dist', name), 'onnxruntime-web browser bundle or WASM')
    }
    drop(path.join(ortWeb, 'lib'), 'onnxruntime-web TypeScript source')
  }

  // better-sqlite3 only loads build/Release/better_sqlite3.node; deps/ and src/
  // are the SQLite and C++ sources it was compiled from.
  const sqlite = path.join(modules, 'better-sqlite3')
  if (exists(path.join(sqlite, 'build', 'Release', 'better_sqlite3.node'))) {
    drop(path.join(sqlite, 'deps'), 'better-sqlite3 C sources')
    drop(path.join(sqlite, 'src'), 'better-sqlite3 C++ sources')
  }

  // Whisper Tiny (ONNX) is the dictation fallback for systems without veenna-whisper.
  // Where veenna-whisper ships, Whisper Base runs on it; Tiny stays downloadable
  // from Settings → Speech models.
  const whisperDir = path.join(resources, 'whisper')
  const helper = platform === 'win32' ? 'veenna-whisper.exe' : 'veenna-whisper'
  if (exists(path.join(whisperDir, 'bin', helper))) {
    drop(path.join(resources, 'models', 'Xenova', 'whisper-tiny'), 'ONNX Whisper Tiny (veenna-whisper ships)')
  }

  return plan
}

function pruneShippedApp(resources, target) {
  const plan = planPrune(resources, target)
  for (const item of plan) fs.rmSync(item.path, { recursive: true, force: true })
  // An emptied models/Xenova folder is left behind otherwise.
  const xenovaModels = path.join(resources, 'models', 'Xenova')
  if (exists(xenovaModels) && listDir(xenovaModels).length === 0) fs.rmdirSync(xenovaModels)
  return { removed: plan.length, bytes: plan.reduce((sum, item) => sum + item.bytes, 0), plan }
}

module.exports = { planPrune, pruneShippedApp }
