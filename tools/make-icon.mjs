import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

// ---------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([length, typeBuf, data, crc])
}

function encodePng(width, height, rgba) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------------------------------------------------------------------------
// drawing — three DIMM-style slots: two filled, one free
// ---------------------------------------------------------------------------

const BG = [14, 19, 26]
const BORDER = [44, 53, 70]
const ACCENT = [139, 92, 246]

function insideRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= r * r
}

function insideBar(x, y, y0, h) {
  const x0 = 0.19
  const x1 = 0.81
  const r = h * 0.32
  if (x < x0 || x > x1 || y < y0 || y > y0 + h) return false
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x
  const cy = y < y0 + r ? y0 + r : y > y0 + h - r ? y0 + h - r : y
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= r * r
}

function colorAt(x, y) {
  if (!insideRoundRect(x, y, 0.03, 0.03, 0.97, 0.97, 0.17)) return null
  if (!insideRoundRect(x, y, 0.055, 0.055, 0.945, 0.945, 0.145)) return BORDER

  const barH = 0.125
  for (let i = 0; i < 3; i++) {
    const y0 = 0.245 + i * 0.225
    if (insideBar(x, y, y0, barH)) {
      const free = i === 2
      if (free) {
        const inner = insideBar(x, y, y0 + 0.033, barH - 0.066)
        if (inner) continue
        return [ACCENT[0], ACCENT[1], ACCENT[2], 255]
      }
      return [ACCENT[0], ACCENT[1], ACCENT[2], 255]
    }
  }
  return BG
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4)
  const S = 4
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const x = (px + (sx + 0.5) / S) / size
          const y = (py + (sy + 0.5) / S) / size
          const c = colorAt(x, y)
          if (c) {
            r += c[0]
            g += c[1]
            b += c[2]
            a += 255
          }
        }
      }
      const n = S * S
      const o = (py * size + px) * 4
      rgba[o] = Math.round(r / n)
      rgba[o + 1] = Math.round(g / n)
      rgba[o + 2] = Math.round(b / n)
      rgba[o + 3] = Math.round(a / n)
    }
  }
  return rgba
}

// ---------------------------------------------------------------------------
// ICO (PNG-compressed entries)
// ---------------------------------------------------------------------------

function encodeIco(sizes) {
  const images = sizes.map((size) => encodePng(size, size, renderIcon(size)))
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(sizes.length, 4)

  const entries = []
  let offset = 6 + images.length * 16
  images.forEach((img, i) => {
    const size = sizes[i]
    const entry = Buffer.alloc(16)
    entry[0] = size >= 256 ? 0 : size
    entry[1] = size >= 256 ? 0 : size
    entry[2] = 0
    entry[3] = 0
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(img.length, 8)
    entry.writeUInt32LE(offset, 12)
    entries.push(entry)
    offset += img.length
  })

  return Buffer.concat([header, ...entries, ...images])
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const root = path.resolve(import.meta.dirname, '..')
const buildDir = path.join(root, 'build')
fs.mkdirSync(buildDir, { recursive: true })

const sizes = [16, 24, 32, 48, 64, 128, 256]
const ico = encodeIco(sizes)
fs.writeFileSync(path.join(buildDir, 'icon.ico'), ico)
fs.writeFileSync(path.join(buildDir, 'icon-256.png'), encodePng(256, 256, renderIcon(256)))

for (const size of sizes) {
  fs.writeFileSync(path.join(buildDir, `icon-${size}.png`), encodePng(size, size, renderIcon(size)))
}

console.log(`icon written: build/icon.ico (${ico.length} bytes, ${sizes.join(', ')})`)
