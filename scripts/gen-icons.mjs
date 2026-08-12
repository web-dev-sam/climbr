#!/usr/bin/env node
/**
 * climbr icon generator — dependency free (node:zlib + node:fs only).
 *
 * Rasterizes the climbr mark (near-black field, bold lime "elbow angle"
 * chevron) into an RGBA buffer with 4x4 supersampled anti-aliasing, then
 * encodes real PNGs by hand: signature + IHDR + IDAT (filter 0 scanlines,
 * zlib deflate) + IEND, each chunk CRC32'd.
 *
 * Deterministic: same input constants -> byte-identical output.
 *
 * Usage: node scripts/gen-icons.mjs
 */

import { deflateSync, constants as zlibConstants } from 'node:zlib'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/* ------------------------------------------------------------------ tokens */

const BG = [0x08, 0x09, 0x0a] // #08090a
const FG = [0xd2, 0xf3, 0x4c] // #d2f34c

/* ------------------------------------------------------------------- glyph */

/**
 * The mark in abstract units: a vertex on the left with two arms sweeping out
 * at +/-30deg (60deg included angle), stroked with round caps/joins.
 * Arm length 1, stroke half-width R. Everything is normalised at draw time so
 * the inked bounding box (caps included) fits the requested glyph box.
 */
const ARM_DEG = 30
const R = 0.19

const A = (ARM_DEG * Math.PI) / 180
const VERTEX = [0, 0]
const TIP_TOP = [Math.cos(A), -Math.sin(A)]
const TIP_BOT = [Math.cos(A), Math.sin(A)]

// Inked bbox of the two capsules.
const BB_X0 = -R
const BB_X1 = TIP_TOP[0] + R
const BB_Y0 = TIP_TOP[1] - R
const BB_Y1 = TIP_BOT[1] + R
const BB_W = BB_X1 - BB_X0
const BB_H = BB_Y1 - BB_Y0
const BB_MAX = Math.max(BB_W, BB_H)
const BB_CX = (BB_X0 + BB_X1) / 2
const BB_CY = (BB_Y0 + BB_Y1) / 2

/** Map the abstract glyph into a centred box of `box` px on a `size` canvas. */
function placeGlyph(size, box) {
  const s = box / BB_MAX
  const cx = size / 2
  const cy = size / 2
  const put = (p) => [cx + (p[0] - BB_CX) * s, cy + (p[1] - BB_CY) * s]
  return { v: put(VERTEX), a: put(TIP_TOP), b: put(TIP_BOT), r: R * s }
}

/* ---------------------------------------------------------------- geometry */

/** Squared distance from point to segment. */
function dist2ToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax
  const vy = by - ay
  const wx = px - ax
  const wy = py - ay
  const len2 = vx * vx + vy * vy
  let t = len2 > 0 ? (wx * vx + wy * vy) / len2 : 0
  if (t < 0) t = 0
  else if (t > 1) t = 1
  const dx = wx - t * vx
  const dy = wy - t * vy
  return dx * dx + dy * dy
}

/** Rounded-rect coverage test for the rect [0,size]^2 with corner `radius`. */
function inRoundRect(px, py, size, radius) {
  if (px < 0 || py < 0 || px > size || py > size) return false
  if (radius <= 0) return true
  const h = size / 2
  const qx = Math.abs(px - h) - (h - radius)
  const qy = Math.abs(py - h) - (h - radius)
  if (qx <= 0 || qy <= 0) return true
  return qx * qx + qy * qy <= radius * radius
}

/* --------------------------------------------------------------- rasteriser */

/**
 * @param {object} o
 * @param {number} o.size      canvas edge in px
 * @param {number} o.radius    corner radius in px (0 = full bleed square)
 * @param {number} o.glyph     glyph box edge in px
 * @param {boolean} o.opaque   drop the alpha channel (RGB output)
 * @param {number} o.ss        supersampling factor per axis
 * @returns {{data: Buffer, channels: number}}
 */
function raster({ size, radius, glyph, opaque, ss = 4 }) {
  const g = placeGlyph(size, glyph)
  const r2 = g.r * g.r
  const n = ss * ss
  const step = 1 / ss
  const off = step / 2
  const channels = opaque ? 3 : 4
  const data = Buffer.alloc(size * size * channels)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let covered = 0
      let sr = 0
      let sg = 0
      let sb = 0

      for (let sy = 0; sy < ss; sy++) {
        const py = y + off + sy * step
        for (let sx = 0; sx < ss; sx++) {
          const px = x + off + sx * step
          if (!inRoundRect(px, py, size, radius)) continue
          covered++
          const onGlyph =
            dist2ToSegment(px, py, g.v[0], g.v[1], g.a[0], g.a[1]) <= r2 ||
            dist2ToSegment(px, py, g.v[0], g.v[1], g.b[0], g.b[1]) <= r2
          const c = onGlyph ? FG : BG
          sr += c[0]
          sg += c[1]
          sb += c[2]
        }
      }

      const i = (y * size + x) * channels
      if (covered === 0) {
        // Fully outside the field: transparent (or the field colour when the
        // output has no alpha channel — cannot happen, radius 0 covers all).
        if (opaque) {
          data[i] = BG[0]
          data[i + 1] = BG[1]
          data[i + 2] = BG[2]
        }
        continue
      }
      data[i] = Math.round(sr / covered)
      data[i + 1] = Math.round(sg / covered)
      data[i + 2] = Math.round(sb / covered)
      if (!opaque) data[i + 3] = Math.round((covered / n) * 255)
    }
  }

  return { data, channels }
}

/* ------------------------------------------------------------ png encoding */

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, payload) {
  const out = Buffer.alloc(12 + payload.length)
  out.writeUInt32BE(payload.length, 0)
  out.write(type, 4, 'latin1')
  payload.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + payload.length)), 8 + payload.length)
  return out
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function encodePNG(pixels, width, height, channels) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = channels === 4 ? 6 : 2 // colour type: RGBA / RGB
  ihdr[10] = 0 // deflate
  ihdr[11] = 0 // adaptive filtering
  ihdr[12] = 0 // no interlace

  const stride = width * channels
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter type 0 (None)
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  const idat = deflateSync(raw, {
    level: zlibConstants.Z_BEST_COMPRESSION,
    memLevel: 9,
    windowBits: 15,
  })

  return Buffer.concat([
    PNG_SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ------------------------------------------------------------------ favicon */

function faviconSVG() {
  const size = 48
  const g = placeGlyph(size, size * 0.72)
  const f = (n) => Number(n.toFixed(3)).toString()
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="climbr">
  <rect width="${size}" height="${size}" rx="${f(size * 0.18)}" fill="#08090a"/>
  <path d="M${f(g.a[0])} ${f(g.a[1])} L${f(g.v[0])} ${f(g.v[1])} L${f(g.b[0])} ${f(g.b[1])}"
        fill="none" stroke="#d2f34c" stroke-width="${f(g.r * 2)}"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`
}

/* --------------------------------------------------------------------- main */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pub = join(root, 'public')
mkdirSync(pub, { recursive: true })

// Scaffold leftovers we replace.
for (const stale of ['icons.svg', 'favicon.svg', 'vite.svg']) {
  const p = join(pub, stale)
  if (existsSync(p)) rmSync(p)
}

const TARGETS = [
  // purpose: any -> rounded-square app tile
  { file: 'pwa-192x192.png', size: 192, radiusFrac: 0.22, glyphFrac: 0.62, opaque: false },
  { file: 'pwa-512x512.png', size: 512, radiusFrac: 0.22, glyphFrac: 0.62, opaque: false },
  // purpose: maskable -> full bleed, glyph inside the safe zone
  { file: 'pwa-maskable-512x512.png', size: 512, radiusFrac: 0, glyphFrac: 0.6, opaque: true },
  // iOS masks the tile itself: full bleed, opaque
  { file: 'apple-touch-icon.png', size: 180, radiusFrac: 0, glyphFrac: 0.62, opaque: true },
  // browser tab: bigger glyph so it survives 16px downscaling
  { file: 'favicon.png', size: 48, radiusFrac: 0.18, glyphFrac: 0.72, opaque: false },
]

const report = []
for (const t of TARGETS) {
  const { data, channels } = raster({
    size: t.size,
    radius: t.size * t.radiusFrac,
    glyph: t.size * t.glyphFrac,
    opaque: t.opaque,
  })
  const png = encodePNG(data, t.size, t.size, channels)
  writeFileSync(join(pub, t.file), png)
  report.push(`${t.file.padEnd(26)} ${t.size}x${t.size}  ${channels === 4 ? 'RGBA' : 'RGB '}  ${png.length} B`)
}

writeFileSync(join(pub, 'favicon.svg'), faviconSVG())

console.log('public/ icons written:')
for (const line of report) console.log('  ' + line)
console.log('  favicon.svg')
