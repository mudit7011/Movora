// Renders 3 logo concepts (anti-aliased, gradient) for preview. Pure Node + zlib.
import zlib from 'node:zlib'
import { writeFileSync } from 'node:fs'

// ---- PNG encoder ----
const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })()
const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const b = Buffer.concat([Buffer.from(type), data]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(b)); return Buffer.concat([l, b, cr]) }
function png(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4) }
  return Buffer.concat([sig, chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

// ---- geometry helpers ----
const inPoly = (px, py, poly) => { let i2 = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1]; if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) i2 = !i2 } return i2 }
const lerp = (a, b, t) => a + (b - a) * t
// gradient cyan -> blue based on vertical position
const grad = (ty) => [Math.round(lerp(34, 10, ty)), Math.round(lerp(224, 132, ty)), Math.round(lerp(234, 255, ty))]

// M polygons (unit square)
const M = [
  [[0.18, 0.27], [0.31, 0.27], [0.31, 0.73], [0.18, 0.73]],          // left bar
  [[0.69, 0.27], [0.82, 0.27], [0.82, 0.73], [0.69, 0.73]],          // right bar
  [[0.18, 0.27], [0.31, 0.27], [0.535, 0.62], [0.465, 0.62]],        // left diagonal
  [[0.82, 0.27], [0.69, 0.27], [0.465, 0.62], [0.535, 0.62]],        // right diagonal
]
const PLAY = [[0.435, 0.45], [0.435, 0.66], [0.60, 0.555]]            // play triangle
const perfs = () => { const a = []; for (let i = 0; i < 7; i++) { const x = 0.10 + i * 0.118; a.push([x, 0.13, x + 0.075, 0.185]); a.push([x, 0.815, x + 0.075, 0.87]) } return a }

function concept(which, size) {
  const ss = 4, S = size * ss
  const buf = Buffer.alloc(S * S * 4)
  const r = S * 0.22
  const PF = perfs()
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const ux = (x + 0.5) / S, uy = (y + 0.5) / S
      // rounded square mask
      const cx = Math.min(x, S - 1 - x), cy = Math.min(y, S - 1 - y)
      let bg = true
      if (cx < r && cy < r) { const dx = r - cx, dy = r - cy; if (dx * dx + dy * dy > r * r) bg = false }
      let col = [0, 0, 0, 0]
      if (bg) {
        // dark base with subtle vertical gradient
        const base = Math.round(lerp(16, 6, uy))
        col = [base, base, base + 2, 255]
        // soft cyan glow center
        const dxg = ux - 0.5, dyg = uy - 0.48, dist = Math.sqrt(dxg * dxg + dyg * dyg)
        const glow = Math.max(0, 1 - dist / 0.55) ** 2 * 0.16
        col = [Math.round(col[0] + 6 * 255 * glow / 255 * 3), Math.round(col[1] + 214 * glow), Math.round(col[2] + 224 * glow), 255]
        let fg = false
        if (which === 1) { for (const p of M) if (inPoly(ux, uy, p)) { fg = true; break } }
        if (which === 2) { for (const p of M) if (inPoly(ux, uy, p)) { fg = true; break }; if (inPoly(ux, uy, PLAY)) fg = false } // M with play cut-out
        if (which === 3) {
          for (const p of M) if (inPoly(ux, uy, p)) { fg = true; break }
          for (const [x0, y0, x1, y1] of PF) if (ux >= x0 && ux <= x1 && uy >= y0 && uy <= y1) fg = true
        }
        if (fg) { const g = grad(uy); col = [g[0], g[1], g[2], 255] }
      }
      const i = (y * S + x) * 4
      buf[i] = col[0]; buf[i + 1] = col[1]; buf[i + 2] = col[2]; buf[i + 3] = col[3]
    }
  }
  // downscale (box) ss->1
  const out = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let R = 0, G = 0, B = 0, A = 0
    for (let dy = 0; dy < ss; dy++) for (let dx = 0; dx < ss; dx++) { const i = ((y * ss + dy) * S + (x * ss + dx)) * 4; const a = buf[i + 3]; R += buf[i] * a; G += buf[i + 1] * a; B += buf[i + 2] * a; A += a }
    const o = (y * size + x) * 4
    if (A === 0) { out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0 } else { out[o] = Math.round(R / A); out[o + 1] = Math.round(G / A); out[o + 2] = Math.round(B / A); out[o + 3] = Math.round(A / (ss * ss)) }
  }
  return png(size, size, out)
}

for (const w of [1, 2, 3]) { writeFileSync(new URL(`../public/logo-option-${w}.png`, import.meta.url), concept(w, 512)); console.log('wrote logo-option-' + w + '.png') }
