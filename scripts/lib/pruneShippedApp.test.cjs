'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { planPrune, pruneShippedApp } = require('./pruneShippedApp.cjs')

const NM = 'app/node_modules'

function resources(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prune-'))
  for (const rel of files) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), 'x')
  }
  return root
}

const shipped = [
  `${NM}/onnxruntime-node/bin/napi-v3/darwin/arm64/onnxruntime_binding.node`,
  `${NM}/onnxruntime-node/bin/napi-v3/darwin/x64/onnxruntime_binding.node`,
  `${NM}/onnxruntime-node/bin/napi-v3/linux/x64/onnxruntime_binding.node`,
  `${NM}/onnxruntime-node/bin/napi-v3/win32/x64/onnxruntime_binding.node`,
  `${NM}/@xenova/transformers/dist/ort-wasm-simd.wasm`,
  `${NM}/@xenova/transformers/dist/ort-wasm.wasm`,
  `${NM}/@xenova/transformers/dist/ort-wasm-simd-threaded.wasm`,
  `${NM}/@xenova/transformers/dist/ort-wasm-threaded.wasm`,
  `${NM}/@xenova/transformers/dist/transformers.min.js`,
  `${NM}/@xenova/transformers/dist/transformers.js.map`,
  `${NM}/@xenova/transformers/src/transformers.js`,
  `${NM}/onnxruntime-web/dist/ort-wasm-simd.wasm`,
  `${NM}/onnxruntime-web/dist/ort.min.js.map`,
  `${NM}/onnxruntime-web/dist/ort-web.node.js`,
  `${NM}/onnxruntime-web/dist/ort-web.min.js`,
  `${NM}/onnxruntime-web/lib/index.ts`,
  `${NM}/better-sqlite3/build/Release/better_sqlite3.node`,
  `${NM}/better-sqlite3/deps/sqlite3/sqlite3.c`,
  `${NM}/better-sqlite3/src/better_sqlite3.cpp`,
  `${NM}/better-sqlite3/lib/index.js`,
  'whisper/bin/veenna-whisper',
  'models/ggml/whisper-base-q5_1/ggml-base-q5_1.bin',
  'models/Xenova/whisper-tiny/config.json',
]

test('keeps exactly what the running app loads', () => {
  const root = resources(shipped)
  pruneShippedApp(root, { platform: 'darwin', arch: 'arm64' })
  const left = (rel) => fs.existsSync(path.join(root, rel))

  assert.ok(left(`${NM}/onnxruntime-node/bin/napi-v3/darwin/arm64/onnxruntime_binding.node`))
  assert.ok(!left(`${NM}/onnxruntime-node/bin/napi-v3/darwin/x64`))
  assert.ok(!left(`${NM}/onnxruntime-node/bin/napi-v3/linux`))
  assert.ok(!left(`${NM}/onnxruntime-node/bin/napi-v3/win32`))

  assert.ok(left(`${NM}/@xenova/transformers/dist/ort-wasm-simd.wasm`))
  assert.ok(left(`${NM}/@xenova/transformers/dist/ort-wasm.wasm`))
  assert.ok(!left(`${NM}/@xenova/transformers/dist/ort-wasm-simd-threaded.wasm`))
  assert.ok(!left(`${NM}/@xenova/transformers/dist/ort-wasm-threaded.wasm`))
  assert.ok(!left(`${NM}/@xenova/transformers/dist/transformers.min.js`))
  assert.ok(left(`${NM}/@xenova/transformers/src/transformers.js`))

  assert.ok(left(`${NM}/onnxruntime-web/dist/ort-web.node.js`))
  assert.ok(!left(`${NM}/onnxruntime-web/dist/ort-wasm-simd.wasm`))
  assert.ok(!left(`${NM}/onnxruntime-web/dist/ort-web.min.js`))
  assert.ok(!left(`${NM}/onnxruntime-web/lib`))

  assert.ok(left(`${NM}/better-sqlite3/build/Release/better_sqlite3.node`))
  assert.ok(left(`${NM}/better-sqlite3/lib/index.js`))
  assert.ok(!left(`${NM}/better-sqlite3/deps`))

  assert.ok(left('models/ggml/whisper-base-q5_1/ggml-base-q5_1.bin'))
  assert.ok(!left('models/Xenova'))
})

test('keeps Whisper Tiny where veenna-whisper does not ship', () => {
  const root = resources(shipped.filter((rel) => !rel.startsWith('whisper/')))
  const plan = planPrune(root, { platform: 'win32', arch: 'x64' })
  assert.ok(!plan.some((item) => item.path.includes('whisper-tiny')))
})

test('leaves the WASM alone when transformers ships none of its own', () => {
  const root = resources(shipped.filter((rel) => !rel.includes('@xenova/transformers/dist/')))
  const plan = planPrune(root, { platform: 'darwin', arch: 'arm64' })
  assert.ok(!plan.some((item) => item.path.includes('onnxruntime-web')))
})

test('leaves onnxruntime-node alone when this target has no binding', () => {
  const root = resources(shipped)
  const plan = planPrune(root, { platform: 'linux', arch: 'arm64' })
  assert.ok(!plan.some((item) => item.path.includes('onnxruntime-node')))
})
