#!/usr/bin/env node
/**
 * Generate Electron packaging icons, favicon, menu bar tray assets, and HUD mark from public/logo.png.
 *
 * Outputs:
 * - build/icon.png, build/icon.icns, build/icon.ico
 * - build/tray/tray-{idle,recording,processing,error}.png
 * - public/favicon.png (32px, for legacy tab favicon fallback)
 * - public/hud-mark.png (transparent center mark for floating HUD)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pngToIco from 'png-to-ico'
import { Icns, IcnsImage } from '@fiahfy/icns'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'public', 'logo.png')
const OUT_DIR = path.join(ROOT, 'build')
const TRAY_DIR = path.join(OUT_DIR, 'tray')
const OUT_PNG = path.join(OUT_DIR, 'icon.png')
const OUT_ICNS = path.join(OUT_DIR, 'icon.icns')
const OUT_ICO = path.join(OUT_DIR, 'icon.ico')
const OUT_FAVICON = path.join(ROOT, 'public', 'favicon.png')
const BASE_SIZE = 1024
const WINDOWS_SIZES = [16, 24, 32, 48, 64, 128, 256]
const ICNS_MAP = [
  ['icp4', 16],
  ['icp5', 32],
  ['icp6', 64],
  ['ic07', 128],
  ['ic08', 256],
  ['ic09', 512],
  ['ic10', 1024],
]
const TRAY_SIZE = 22

if (!fs.existsSync(SRC)) {
  console.error('electron-icons: source logo not found:', SRC)
  process.exit(1)
}

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.mkdirSync(TRAY_DIR, { recursive: true })

async function loadSharp() {
  const sharp = (await import('sharp')).default
  return sharp
}

async function buildSizedPng(sharp, size, outputPath, fit = 'contain') {
  await sharp(SRC)
    .resize(size, size, {
      fit,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outputPath)
}

async function generateIco(sharp) {
  const tempPngs = await Promise.all(
    WINDOWS_SIZES.map(async (size) => {
      const tempPath = path.join(OUT_DIR, `icon.win.${size}.png`)
      await buildSizedPng(sharp, size, tempPath)
      return tempPath
    }),
  )
  fs.writeFileSync(OUT_ICO, await pngToIco(tempPngs))
  tempPngs.forEach((tempPath) => fs.rmSync(tempPath, { force: true }))
}

async function generateIcns(sharp) {
  const icns = new Icns()
  for (const [osType, size] of ICNS_MAP) {
    const tempPath = path.join(OUT_DIR, `icon.mac.${size}.png`)
    await buildSizedPng(sharp, size, tempPath)
    icns.append(IcnsImage.fromPNG(fs.readFileSync(tempPath), osType))
    fs.rmSync(tempPath, { force: true })
  }
  fs.writeFileSync(OUT_ICNS, icns.data)
}

async function generateHudMark(sharp) {
  const meta = await sharp(SRC).metadata()
  const size = meta.width || BASE_SIZE
  const crop = Math.round(size * 0.14)
  const left = Math.round((size - crop) / 2)
  const OUT_HUD_MARK = path.join(ROOT, 'public', 'hud-mark.png')
  const MARK_SIZE = 96
  const CANVAS = 128

  const { data, info } = await sharp(SRC)
    .extract({ left, top: left, width: crop, height: crop })
    .resize(MARK_SIZE, MARK_SIZE, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    if (r > 230 && g > 230 && b > 230) {
      data[i + 3] = 0
      continue
    }
    const lum = (r + g + b) / 3
    const mark = Math.max(0, Math.min(1, 1 - lum / 255))
    data[i] = 255
    data[i + 1] = 255
    data[i + 2] = 255
    data[i + 3] = Math.round(a * mark)
  }

  const padded = Buffer.alloc(CANVAS * CANVAS * 4, 0)
  const ox = Math.round((CANVAS - width) / 2)
  const oy = Math.round((CANVAS - height) / 2)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4
      const di = ((y + oy) * CANVAS + (x + ox)) * 4
      padded[di] = data[si]
      padded[di + 1] = data[si + 1]
      padded[di + 2] = data[si + 2]
      padded[di + 3] = data[si + 3]
    }
  }

  // Drop disconnected crop-edge slivers; keep only the largest mark blob.
  const labels = new Int32Array(CANVAS * CANVAS)
  let nextLabel = 1
  const sizes = new Map()
  const idx = (x, y) => y * CANVAS + x
  const alphaAt = (i) => padded[i * 4 + 3] > 20

  for (let y = 0; y < CANVAS; y++) {
    for (let x = 0; x < CANVAS; x++) {
      const i = idx(x, y)
      if (!alphaAt(i) || labels[i]) continue
      const label = nextLabel++
      let count = 0
      const stack = [i]
      labels[i] = label
      while (stack.length) {
        const cur = stack.pop()
        count++
        const cx = cur % CANVAS
        const cy = (cur / CANVAS) | 0
        for (const [nx, ny] of [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1],
        ]) {
          if (nx < 0 || ny < 0 || nx >= CANVAS || ny >= CANVAS) continue
          const ni = idx(nx, ny)
          if (labels[ni] || !alphaAt(ni)) continue
          labels[ni] = label
          stack.push(ni)
        }
      }
      sizes.set(label, count)
    }
  }

  let best = 0
  let bestSize = 0
  for (const [label, count] of sizes) {
    if (count > bestSize) {
      bestSize = count
      best = label
    }
  }

  for (let i = 0; i < CANVAS * CANVAS; i++) {
    if (labels[i] !== best) padded[i * 4 + 3] = 0
  }

  await sharp(padded, { raw: { width: CANVAS, height: CANVAS, channels: 4 } })
    .png()
    .toFile(OUT_HUD_MARK)
}

async function generateTrayIcons(sharp) {
  const states = ['idle', 'recording', 'processing']
  for (const state of states) {
    await buildSizedPng(sharp, TRAY_SIZE, path.join(TRAY_DIR, `tray-${state}.png`))
  }
  fs.copyFileSync(path.join(TRAY_DIR, 'tray-recording.png'), path.join(TRAY_DIR, 'tray-error.png'))
}

try {
  const sharp = await loadSharp()
  await buildSizedPng(sharp, BASE_SIZE, OUT_PNG)
  await buildSizedPng(sharp, 32, OUT_FAVICON)
  await Promise.all([
    generateIco(sharp),
    generateIcns(sharp),
    generateTrayIcons(sharp),
    generateHudMark(sharp),
  ])
  console.log('electron-icons: generated from public/logo.png')
  console.log('  - build/icon.png, icon.icns, icon.ico')
  console.log('  - build/tray/tray-{idle,recording,processing,error}.png')
  console.log('  - public/favicon.png')
  console.log('  - public/hud-mark.png')
} catch (error) {
  console.error('electron-icons: failed to generate icons.', error)
  process.exit(1)
}
