// Generate PWA PNG icons without external dependencies.
// Draws the moto/road logo into an RGBA buffer and encodes PNG via zlib.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'icons')
mkdirSync(OUT, { recursive: true })

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const ORANGE1 = hex('#fb923c')
const ORANGE2 = hex('#c2410c')
const DARK = hex('#0f172a')
const WHITE = [255, 255, 255]

function draw(size) {
  const buf = new Uint8ClampedArray(size * size * 4)
  const s = size / 512 // scale from 512 design space
  const px = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    const na = a / 255
    buf[i] = buf[i] * (1 - na) + r * na
    buf[i + 1] = buf[i + 1] * (1 - na) + g * na
    buf[i + 2] = buf[i + 2] * (1 - na) + b * na
    buf[i + 3] = Math.max(buf[i + 3], a)
  }

  // rounded-rect background with diagonal gradient
  const radius = 112 * s
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // rounded corner mask
      const rx = Math.min(x, size - 1 - x)
      const ry = Math.min(y, size - 1 - y)
      let inside = true
      if (rx < radius && ry < radius) {
        const dx = radius - rx
        const dy = radius - ry
        if (dx * dx + dy * dy > radius * radius) inside = false
      }
      if (!inside) continue
      const t = (x + y) / (2 * size)
      const r = ORANGE1[0] + (ORANGE2[0] - ORANGE1[0]) * t
      const g = ORANGE1[1] + (ORANGE2[1] - ORANGE1[1]) * t
      const b = ORANGE1[2] + (ORANGE2[2] - ORANGE1[2]) * t
      px(x, y, [r, g, b])
    }
  }

  // thick disc helper (for strokes) in 512-space coords
  const disc = (cx, cy, rad, color, a = 255) => {
    const CX = cx * s, CY = cy * s, R = rad * s
    for (let y = Math.floor(CY - R); y <= CY + R; y++)
      for (let x = Math.floor(CX - R); x <= CX + R; x++) {
        const dx = x - CX, dy = y - CY
        if (dx * dx + dy * dy <= R * R) px(x, y, color, a)
      }
  }
  const ring = (cx, cy, rad, w, color) => {
    const CX = cx * s, CY = cy * s, R = rad * s, W = w * s
    for (let y = Math.floor(CY - R - W); y <= CY + R + W; y++)
      for (let x = Math.floor(CX - R - W); x <= CX + R + W; x++) {
        const d = Math.hypot(x - CX, y - CY)
        if (d <= R + W / 2 && d >= R - W / 2) px(x, y, color)
      }
  }
  const line = (x1, y1, x2, y2, w, color) => {
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * s)
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      disc(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, w / 2, color)
    }
  }

  // winding road (dashed white)
  const road = []
  for (let t = 0; t <= 1; t += 0.01) {
    // simple bezier-ish path from (120,400) up to (300,110)
    const x = 120 + (300 - 120) * t + 60 * Math.sin(t * Math.PI * 2)
    const y = 400 - (400 - 110) * t
    road.push([x, y])
  }
  road.forEach(([x, y], idx) => {
    if (idx % 6 < 3) disc(x, y, 13, WHITE, 240)
  })

  // wheels
  ring(170, 360, 46, 20, DARK)
  ring(360, 360, 46, 20, DARK)
  disc(170, 360, 10, DARK)
  disc(360, 360, 10, DARK)
  // body frame
  line(170, 360, 250, 300, 20, DARK)
  line(250, 300, 330, 300, 20, DARK)
  line(330, 300, 360, 360, 20, DARK)
  line(250, 300, 300, 275, 20, DARK)
  // pin
  disc(300, 110, 34, DARK)
  disc(300, 110, 14, WHITE)

  return Buffer.from(buf.buffer)
}

// --- minimal PNG encoder ---
function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return ~c >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}
function encodePNG(rgba, size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  // filter 0 per scanline
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const { size, name } of [
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 512, name: 'icon-maskable-512.png' },
]) {
  const rgba = draw(size)
  writeFileSync(join(OUT, name), encodePNG(rgba, size))
  console.log('wrote', name, size)
}
