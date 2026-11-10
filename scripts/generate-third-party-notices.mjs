/**
 * Writes src/assets/licenses/third-party-notices.txt: the licence of every third-party package
 * that ships in Veenna Community. Run after dependencies change:
 *
 *   bun scripts/generate-third-party-notices.mjs
 *
 * Which packages ship:
 *   - the window: every node_modules module Vite pulls into the renderer bundle;
 *   - the main process: the `dependencies` in package.json and everything they depend on;
 *   - the speech engine: whisper.cpp and the Whisper models, listed by hand below.
 * Nothing here uses a regular expression.
 */
import fs from 'node:fs'
import path from 'node:path'
import { build } from 'vite'

const root = path.resolve(import.meta.dirname, '..')
const outFile = path.join(root, 'src/assets/licenses/third-party-notices.txt')
const marker = `${path.sep}node_modules${path.sep}`

/** `/x/node_modules/@a/b/dist/c.js` -> `/x/node_modules/@a/b`, or null when not in node_modules. */
function packageDirOf(file) {
  const at = file.lastIndexOf(marker)
  if (at === -1) return null
  const base = file.slice(0, at + marker.length)
  const parts = file.slice(at + marker.length).split(path.sep)
  const count = parts[0].startsWith('@') ? 2 : 1
  return base + parts.slice(0, count).join(path.sep)
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/** Resolves a dependency the way node does: nearest node_modules walking up from `from`. */
function resolveDep(name, from) {
  let dir = from
  for (;;) {
    const candidate = path.join(dir, 'node_modules', name)
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

const packages = new Map() // dir -> { name, version }

function addTree(dir, seen = new Set()) {
  if (seen.has(dir)) return
  seen.add(dir)
  const pkg = readJson(path.join(dir, 'package.json'))
  if (!pkg) return
  packages.set(dir, { name: pkg.name, version: pkg.version })
  // Optional dependencies count: sharp's native libvips build arrives that way and ships.
  const deps = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.optionalDependencies || {})]
  for (const dep of deps) {
    const found = resolveDep(dep, dir)
    if (found) addTree(found, seen)
  }
}

// The window.
const rendererFiles = []
await build({
  configFile: path.join(root, 'vite.config.ts'),
  logLevel: 'error',
  build: { write: false, minify: false },
  plugins: [
    {
      name: 'collect-modules',
      buildEnd() {
        for (const id of this.getModuleIds()) {
          const file = id.split('?')[0]
          if (file.includes('node_modules')) rendererFiles.push(file)
        }
      },
    },
  ],
})
for (const file of rendererFiles) {
  const dir = packageDirOf(file)
  if (dir) addTree(dir)
}

// The main process.
const rootPkg = readJson(path.join(root, 'package.json'))
for (const dep of Object.keys(rootPkg.dependencies || {})) {
  const found = resolveDep(dep, root)
  if (found) addTree(found)
}

// Icons the build plugin (scripts/icon-packs-plugin.mjs) reads from these packs and inlines.
for (const name of ['@iconify-json/ph', '@iconify-json/lucide', '@iconify-json/vscode-icons']) {
  const found = resolveDep(name, root)
  if (found) addTree(found)
}

function licenseName(pkg) {
  const value = pkg.license ?? pkg.licenses
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && !Array.isArray(value)) return value.type || 'See licence text'
  if (Array.isArray(value)) return value.map((entry) => entry.type || entry).join(' OR ')
  return 'See licence text'
}

function repositoryOf(pkg) {
  const repo = pkg.repository
  const url = typeof repo === 'string' ? repo : repo?.url
  if (!url) return pkg.homepage || ''
  let clean = url
  if (clean.startsWith('git+')) clean = clean.slice(4)
  if (clean.endsWith('.git')) clean = clean.slice(0, -4)
  if (clean.startsWith('git://')) clean = `https://${clean.slice(6)}`
  return clean
}

function licenseTextOf(dir) {
  const names = fs.readdirSync(dir)
  const wanted = ['license', 'licence', 'copying']
  for (const name of names) {
    const lower = name.toLowerCase()
    const stem = lower.includes('.') ? lower.slice(0, lower.indexOf('.')) : lower
    if (wanted.includes(stem) && fs.statSync(path.join(dir, name)).isFile()) {
      return fs.readFileSync(path.join(dir, name), 'utf8').trim()
    }
  }
  return ''
}

const rule = '-'.repeat(79)
const entries = [...packages.entries()]
  .filter(([dir]) => dir !== root)
  .map(([dir, info]) => {
    const pkg = readJson(path.join(dir, 'package.json')) || {}
    return {
      name: info.name,
      version: info.version,
      license: licenseName(pkg),
      repo: repositoryOf(pkg),
      text: licenseTextOf(dir),
    }
  })
  .filter((entry) => entry.name)
  .sort((a, b) => a.name.localeCompare(b.name))

const byLicense = new Map()
for (const entry of entries) byLicense.set(entry.license, (byLicense.get(entry.license) || 0) + 1)

const lines = []
lines.push('Veenna Community - third-party notices')
lines.push('======================================')
lines.push('')
lines.push('Veenna Community is released under the MIT License (see LICENSE). It includes the')
lines.push('open-source software below. Each notice is reproduced as its licence requires.')
lines.push('')
lines.push('Speech engine')
lines.push(rule)
lines.push('')
lines.push('whisper.cpp / ggml - https://github.com/ggml-org/whisper.cpp')
lines.push('Licensed under the MIT License. Copyright (c) 2023-2026 The ggml authors.')
lines.push('')
lines.push('Whisper models (ggml and ONNX conversions) - https://github.com/openai/whisper')
lines.push('Licensed under the MIT License. Copyright (c) 2022 OpenAI.')
lines.push('The model files are downloaded or bundled as weights; the ONNX tiny model comes from')
lines.push('https://huggingface.co/Xenova/whisper-tiny.')
lines.push('')
lines.push('Geist typeface - https://github.com/vercel/geist-font')
lines.push('Licensed under the SIL Open Font License 1.1. Copyright (c) 2023 Vercel, in collaboration with')
lines.push('basement.studio. The licence text is at https://openfontlicense.org.')
lines.push('')
lines.push('Electron and Chromium')
lines.push(rule)
lines.push('')
lines.push('The app runs on Electron (MIT License, Copyright (c) Electron contributors and GitHub')
lines.push('Inc.). Chromium and its own third-party components are covered by the notices in')
lines.push('LICENSES.chromium.html, shipped in the app\'s licenses folder (Resources/licenses).')
lines.push('')
lines.push('libvips')
lines.push(rule)
lines.push('')
lines.push('The image library sharp brings a prebuilt libvips (LGPL-3.0-or-later; source at')
lines.push('https://github.com/libvips/libvips). Veenna Community never processes images with it;')
lines.push('it comes with the speech library. It ships as a separate native library file in the')
lines.push('app, not compiled into it, so it can be replaced with another build of libvips.')
lines.push('')
lines.push(`Packages (${entries.length})`)
lines.push(rule)
lines.push('')
lines.push('Licences in use: ' + [...byLicense.entries()].map(([name, count]) => `${name} (${count})`).join(', '))
lines.push('')
for (const entry of entries) {
  lines.push(rule)
  lines.push(`${entry.name} ${entry.version}`)
  lines.push(`Licence: ${entry.license}`)
  if (entry.repo) lines.push(entry.repo)
  lines.push('')
  lines.push(entry.text || `(No licence file in the package; it declares ${entry.license}.)`)
  lines.push('')
}

fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, lines.join('\n'))
console.log(`wrote ${path.relative(root, outFile)}: ${entries.length} packages`)
console.log([...byLicense.entries()].map(([name, count]) => `${name}: ${count}`).join('\n'))
