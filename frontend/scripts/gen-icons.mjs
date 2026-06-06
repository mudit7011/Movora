// One-off: generates Movora PWA PNG icons (no external image deps; uses zlib).
// Draws a brand-cyan "M" on a dark rounded square. Outputs to public/.
import zlib from 'node:zlib'
import { writeFileSync } from 'node:fs'

const BG = [10, 10, 10, 255]        // #0A0A0A
const FG = [6, 214, 224, 255]       // #06D6E0 (primary cyan)

// CRC32
const crcTable = (() => {
  const t = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const t = Buffer.from(type, 'ascii')
  const body = Buffer.concat([t, data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// point-in-polygon (even-odd)
function inPoly(px, py, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1]
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function render(size) {
  const rgba = Buffer.alloc(size * size * 4)
  const r = size * 0.22 // corner radius
  // "M" geometry on unit square -> scaled; thick strokes via polygons
  const S = size
  const polys = [
    // left vertical bar
    [[0.20, 0.26], [0.33, 0.26], [0.33, 0.74], [0.20, 0.74]],
    // right vertical bar
    [[0.67, 0.26], [0.80, 0.26], [0.80, 0.74], [0.67, 0.74]],
    // left diagonal (top-left inner -> center valley)
    [[0.20, 0.26], [0.33, 0.26], [0.535, 0.60], [0.465, 0.60]],
    // right diagonal (top-right inner -> center valley)
    [[0.80, 0.26], [0.67, 0.26], [0.465, 0.60], [0.535, 0.60]],
  ].map(p => p.map(([x, y]) => [x * S, y * S]))

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4
      // rounded-square mask
      let inside = true
      const cx = Math.min(x, S - 1 - x), cy = Math.min(y, S - 1 - y)
      if (cx < r && cy < r) {
        const dx = r - cx, dy = r - cy
        if (dx * dx + dy * dy > r * r) inside = false
      }
      let col = inside ? BG : [0, 0, 0, 0]
      if (inside) {
        for (const poly of polys) {
          if (inPoly(x + 0.5, y + 0.5, poly)) { col = FG; break }
        }
      }
      rgba[i] = col[0]; rgba[i + 1] = col[1]; rgba[i + 2] = col[2]; rgba[i + 3] = col[3]
    }
  }
  return encodePNG(S, S, rgba)
}

for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-icon-180.png', 180]]) {
  writeFileSync(new URL(`../public/${name}`, import.meta.url), render(size))
  console.log('wrote public/' + name)
}
