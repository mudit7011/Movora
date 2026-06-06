/**
 * Generate PWA icon PNGs from our icon.svg using pure Node.js
 * We render a high-quality PNG version of the SVG icon at multiple sizes
 * using a raw-pixel PNG encoder (no dependencies needed).
 */
import { writeFileSync, readFileSync } from 'node:fs'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── PNG encoder helpers ──
const crcTable = (() => {
  const t = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => {
  const l = Buffer.alloc(4); l.writeUInt32BE(data.length)
  const b = Buffer.concat([Buffer.from(type), data])
  const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(b))
  return Buffer.concat([l, b, cr])
}

function createPNG(w, h, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc(h * (1 + w * 4))
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0 // filter none
    pixels.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4)
  }
  const compressed = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))])
}

// ── Draw the Movora "M" icon at a given size ──
function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4)

  const set = (x, y, r, g, b, a) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return
    const i = (y * size + x) * 4
    // Alpha blend
    const srcA = a / 255
    const dstA = px[i + 3] / 255
    const outA = srcA + dstA * (1 - srcA)
    if (outA === 0) return
    px[i] = Math.round((r * srcA + px[i] * dstA * (1 - srcA)) / outA)
    px[i + 1] = Math.round((g * srcA + px[i + 1] * dstA * (1 - srcA)) / outA)
    px[i + 2] = Math.round((b * srcA + px[i + 2] * dstA * (1 - srcA)) / outA)
    px[i + 3] = Math.round(outA * 255)
  }

  const s = size / 32 // scale factor

  // 1) Fill background - dark gradient
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = (x + y) / (2 * size)
      const r = Math.round(19 * (1 - t) + 10 * t) // #131313 -> #0A0A0A
      const g = r
      const b = r
      // Rounded corners
      const cornerR = 7.5 * s
      const inCorner = (cx, cy) => {
        const dx = x - cx, dy = y - cy
        return Math.sqrt(dx * dx + dy * dy) > cornerR
      }
      let outside = false
      if (x < cornerR && y < cornerR) outside = inCorner(cornerR, cornerR)
      if (x >= size - cornerR && y < cornerR) outside = inCorner(size - cornerR, cornerR)
      if (x < cornerR && y >= size - cornerR) outside = inCorner(cornerR, size - cornerR)
      if (x >= size - cornerR && y >= size - cornerR) outside = inCorner(size - cornerR, size - cornerR)
      
      if (!outside) set(x, y, r, g, b, 255)
    }
  }

  // 2) Radial glow in center
  const cx = 16 * s, cy = 16 * s
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - cx) / (12 * s), dy = (y - cy) / (10 * s)
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < 1) {
        const alpha = Math.round(0.18 * 255 * (1 - d))
        set(x, y, 6, 214, 224, alpha)
      }
    }
  }

  // 3) Draw the "M" path: M7,23 V9 L16,17.5 L25,9 V23
  // Using thick anti-aliased lines
  const strokeW = 2.6 * s
  const drawLine = (x1, y1, x2, y2) => {
    x1 *= s; y1 *= s; x2 *= s; y2 *= s
    const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    const steps = Math.ceil(len * 3)
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const px_ = x1 + (x2 - x1) * t
      const py_ = y1 + (y2 - y1) * t
      // Draw circle at this point
      const r = strokeW / 2
      for (let dy = -Math.ceil(r) - 1; dy <= Math.ceil(r) + 1; dy++) {
        for (let dx = -Math.ceil(r) - 1; dx <= Math.ceil(r) + 1; dx++) {
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist <= r + 0.5) {
            const ix = Math.round(px_ + dx), iy = Math.round(py_ + dy)
            // Gradient color: lerp from #1CF5FF to #06B6C2 based on position
            const gt = ((ix / s - 7) + (iy / s - 9)) / ((25 - 7) + (23 - 9))
            const cr = Math.round(28 * (1 - gt) + 6 * gt)
            const cg = Math.round(245 * (1 - gt) + 182 * gt)
            const cb = Math.round(255 * (1 - gt) + 194 * gt)
            const aa = dist <= r - 0.5 ? 255 : Math.round((1 - (dist - r + 0.5)) * 255)
            set(ix, iy, cr, cg, cb, aa)
          }
        }
      }
    }
  }

  // M shape: left vertical, left diagonal, right diagonal, right vertical
  drawLine(7, 23, 7, 9)      // left vertical
  drawLine(7, 9, 16, 17.5)   // left diagonal
  drawLine(16, 17.5, 25, 9)  // right diagonal
  drawLine(25, 9, 25, 23)    // right vertical

  // 4) Small dot
  const dotR = 1.1 * s
  for (let y = Math.floor(18.5 * s - dotR - 1); y <= Math.ceil(18.5 * s + dotR + 1); y++) {
    for (let x = Math.floor(16 * s - dotR - 1); x <= Math.ceil(16 * s + dotR + 1); x++) {
      const d = Math.sqrt((x - 16 * s) ** 2 + (y - 18.5 * s) ** 2)
      if (d <= dotR + 0.5) {
        const aa = d <= dotR - 0.5 ? Math.round(0.75 * 255) : Math.round(0.75 * (1 - (d - dotR + 0.5)) * 255)
        set(x, y, 28, 245, 255, aa)
      }
    }
  }

  // 5) Border stroke
  const borderW = 0.75 * s
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cornerR = 7 * s
      // Check if near border
      let distFromEdge = Math.min(x, y, size - 1 - x, size - 1 - y)
      
      // Corners
      const checkCorner = (cx_, cy_) => {
        const dx = x - cx_, dy = y - cy_
        const d = Math.sqrt(dx * dx + dy * dy)
        return Math.abs(d - cornerR)
      }
      
      let isBorder = false
      if (x < cornerR && y < cornerR) {
        isBorder = checkCorner(cornerR, cornerR) < borderW
      } else if (x >= size - cornerR && y < cornerR) {
        isBorder = checkCorner(size - cornerR, cornerR) < borderW
      } else if (x < cornerR && y >= size - cornerR) {
        isBorder = checkCorner(cornerR, size - cornerR) < borderW
      } else if (x >= size - cornerR && y >= size - cornerR) {
        isBorder = checkCorner(size - cornerR, size - cornerR) < borderW
      } else {
        isBorder = distFromEdge < borderW
      }
      
      if (isBorder) {
        set(x, y, 6, 214, 224, Math.round(0.22 * 255))
      }
    }
  }

  return createPNG(size, size, px)
}

// Generate icons at required sizes
const sizes = [
  { size: 512, file: 'icon-512.png' },
  { size: 192, file: 'icon-192.png' },
  { size: 180, file: 'apple-icon-180.png' },
]

const publicDir = join(__dirname, '..', 'public')

for (const { size, file } of sizes) {
  const png = drawIcon(size)
  const out = join(publicDir, file)
  writeFileSync(out, png)
  console.log(`✓ ${file} (${size}x${size}, ${png.length} bytes)`)
}

// Also generate a 32x32 favicon
const favicon32 = drawIcon(32)
writeFileSync(join(publicDir, '..', 'src', 'app', 'favicon.ico'), favicon32)
console.log(`✓ favicon.ico (32x32)`)

console.log('\nDone! All icons generated from SVG design.')
