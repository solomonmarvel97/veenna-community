/**
 * Serves the note icon packs as lazy chunks: `virtual:icon-pack/ph-fill` is every Phosphor icon
 * in the fill weight, `virtual:icon-pack/lucide` every Lucide icon, `virtual:icon-pack/vsc` the VS Code file icons. Each chunk is
 * `{ size, icons: { name: svgBody } }`, cut at build time from the Iconify JSON packs, so the app
 * bundle never carries them and a picker loads only the style it shows.
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const PREFIX = 'virtual:icon-pack/'
const RESOLVED_PREFIX = `\0${PREFIX}`
const PHOSPHOR_WEIGHTS = ['thin', 'light', 'bold', 'fill', 'duotone']

/** Phosphor names its weights `house-bold`, `house-fill`; plain `house` is regular. */
function phosphorChunk(weight) {
  const pack = require('@iconify-json/ph/icons.json')
  const icons = {}
  for (const [name, icon] of Object.entries(pack.icons)) {
    let base = name
    let style = 'regular'
    for (const candidate of PHOSPHOR_WEIGHTS) {
      const suffix = `-${candidate}`
      const stem = name.slice(0, -suffix.length)
      // `archive-tray-bold` is an icon of its own when there is no plain `archive-tray`.
      if (name.endsWith(suffix) && Object.hasOwn(pack.icons, stem)) {
        base = stem
        style = candidate
        break
      }
    }
    if (style === weight) icons[base] = icon.body
  }
  return { size: pack.width ?? 256, icons }
}

/** Lucide has one drawing per icon; its stroke weights are drawn from it at render time. */
function lucideChunk() {
  const pack = require('@iconify-json/lucide/icons.json')
  const icons = {}
  for (const [name, icon] of Object.entries(pack.icons)) {
    // The odd icon on its own canvas would draw squashed in a square box.
    if (icon.width || icon.height) continue
    icons[name] = icon.body
  }
  return { size: pack.width ?? 24, icons }
}

/**
 * The VS Code file icon set: a coloured icon per file kind (`file-type-typescript`, `file-type-docker`).
 * They carry their own colours, so a note's colour never applies to them. File types, folder types (each
 * with its `-opened` twin) and the defaults are cut, not the light-theme twins, and the odd icon on its
 * own canvas is left out.
 */
function vscodeChunk() {
  const pack = require('@iconify-json/vscode-icons/icons.json')
  const icons = {}
  for (const [name, icon] of Object.entries(pack.icons)) {
    const wanted =
      name.startsWith('file-type-') || name.startsWith('folder-type-') || name.startsWith('default-')
    if (!wanted || name.includes('-light-')) continue
    if (icon.width || icon.height) continue
    icons[name] = icon.body
  }
  return { size: pack.width ?? 32, icons }
}

function chunkFor(id) {
  if (id === 'vsc') return vscodeChunk()
  if (id === 'lucide') return lucideChunk()
  if (!id.startsWith('ph-')) return null
  const weight = id.slice('ph-'.length)
  if (weight !== 'regular' && !PHOSPHOR_WEIGHTS.includes(weight)) return null
  return phosphorChunk(weight)
}

export function iconPacks() {
  return {
    name: 'icon-packs',
    resolveId(source) {
      return source.startsWith(PREFIX) ? `\0${source}` : null
    },
    load(id) {
      if (!id.startsWith(RESOLVED_PREFIX)) return null
      const chunk = chunkFor(id.slice(RESOLVED_PREFIX.length))
      if (!chunk) return null
      return `export default JSON.parse(${JSON.stringify(JSON.stringify(chunk))})`
    },
  }
}
