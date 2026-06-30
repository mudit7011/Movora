import { Router } from 'express'
import { URL } from 'url'

export const sportsRouter = Router()

const STREAMED_BASE = 'https://streamed.su'
const STREAMED_REFERER = 'https://streamed.su/'
const NOWHDTIME_BASE = 'https://nowhdtime.to'

async function fetchWithTimeout(url: string, opts: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 10_000, ...fetchOpts } = opts
  return fetch(url, { ...fetchOpts, signal: AbortSignal.timeout(timeoutMs) })
}

// Block SSRF — private/loopback ranges
const PRIVATE_IP = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1$|fc|fd)/i

function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:') return false
    const host = u.hostname
    if (PRIVATE_IP.test(host)) return false
    // Must be an external host (at least one dot)
    if (!host.includes('.')) return false
    return true
  } catch {
    return false
  }
}

// Rewrite m3u8 so every URI goes through our proxy
function rewriteM3u8(content: string, baseUrl: string, referer: string): string {
  const base = new URL(baseUrl)
  const mkProxy = (uri: string) => {
    let abs: string
    try {
      abs = new URL(uri, base).href
    } catch {
      return uri
    }
    return `/api/sports/proxy?url=${encodeURIComponent(abs)}&referer=${encodeURIComponent(referer)}`
  }

  return content
    .split('\n')
    .map(line => {
      const trimmed = line.trim()
      if (!trimmed) return line
      // Rewrite KEY URI
      if (trimmed.startsWith('#EXT-X-KEY')) {
        return line.replace(/URI="([^"]+)"/, (_, u) => `URI="${mkProxy(u)}"`)
      }
      // Rewrite MAP URI (fmp4 init segment)
      if (trimmed.startsWith('#EXT-X-MAP')) {
        return line.replace(/URI="([^"]+)"/, (_, u) => `URI="${mkProxy(u)}"`)
      }
      // Non-comment line = segment or sub-playlist URI
      if (!trimmed.startsWith('#')) {
        return mkProxy(trimmed)
      }
      return line
    })
    .join('\n')
}

// ─── Events list ─────────────────────────────────────────────────────────────
// In-memory cache: 3 minutes
let eventsCache: { data: unknown; ts: number } | null = null
const EVENTS_TTL = 3 * 60 * 1000

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

sportsRouter.get('/events', async (_req, res) => {
  if (eventsCache && Date.now() - eventsCache.ts < EVENTS_TTL) {
    res.json(eventsCache.data)
    return
  }

  // Try streamed.su first (works from Render/US); fall back to nowhdtime.to (works anywhere)
  const sources = [
    { url: `${STREAMED_BASE}/api/matches/all`, referer: STREAMED_REFERER, timeoutMs: 3_000 },
    { url: `${NOWHDTIME_BASE}/api/matches/all`, referer: `${NOWHDTIME_BASE}/`, timeoutMs: 8_000 },
  ]

  for (const src of sources) {
    try {
      const r = await fetchWithTimeout(src.url, {
        timeoutMs: src.timeoutMs,
        headers: { 'User-Agent': UA, 'Referer': src.referer, 'Accept': 'application/json' },
      })
      if (!r.ok) continue
      const matches: unknown[] = await r.json()
      if (!Array.isArray(matches) || matches.length === 0) continue
      const data = { events: matches }
      eventsCache = { data, ts: Date.now() }
      res.json(data)
      return
    } catch { /* try next */ }
  }

  if (eventsCache) { res.json(eventsCache.data); return }
  res.status(502).json({ error: 'Failed to fetch events' })
})

// ─── Stream URLs for a match ──────────────────────────────────────────────────
// Cache per source+matchId: 60 seconds
const streamCache = new Map<string, { data: unknown; ts: number }>()
const STREAM_TTL = 60_000

sportsRouter.get('/stream/:source/:matchId', async (req, res) => {
  const { source, matchId } = req.params
  const key = `${source}:${matchId}`
  const hit = streamCache.get(key)
  if (hit && Date.now() - hit.ts < STREAM_TTL) {
    res.json(hit.data)
    return
  }

  const streamSources = [
    { base: STREAMED_BASE, referer: STREAMED_REFERER, timeoutMs: 7_000 },
    { base: NOWHDTIME_BASE, referer: `${NOWHDTIME_BASE}/`, timeoutMs: 8_000 },
  ]

  for (const src of streamSources) {
    try {
      const r = await fetchWithTimeout(
        `${src.base}/api/stream/${encodeURIComponent(source)}/${encodeURIComponent(matchId)}`,
        { timeoutMs: src.timeoutMs, headers: { 'User-Agent': UA, 'Referer': src.referer, 'Accept': 'application/json' } }
      )
      if (!r.ok) continue
      const streams: unknown[] = await r.json()
      if (!Array.isArray(streams)) continue
      const data = { streams, referer: src.referer }
      streamCache.set(key, { data, ts: Date.now() })
      if (streamCache.size > 500) {
        const oldest = [...streamCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0]
        streamCache.delete(oldest[0])
      }
      res.json(data)
      return
    } catch { /* try next */ }
  }

  const stale = streamCache.get(key)
  if (stale) { res.json(stale.data); return }
  res.status(502).json({ error: 'Failed to fetch streams' })
})

// ─── HLS proxy ───────────────────────────────────────────────────────────────
sportsRouter.get('/proxy', async (req, res) => {
  const urlParam = req.query.url as string | undefined
  const referer = (req.query.referer as string | undefined) || STREAMED_REFERER

  if (!urlParam) { res.status(400).json({ error: 'url required' }); return }
  if (!isSafeUrl(urlParam)) { res.status(400).json({ error: 'Invalid URL' }); return }

  try {
    const upstream = await fetch(urlParam, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': referer,
        'Origin': (() => { try { return new URL(referer).origin } catch { return referer } })(),
      },
      signal: AbortSignal.timeout(20_000),
    })

    const ct = upstream.headers.get('content-type') || ''
    const isPlaylist = ct.includes('mpegurl') || ct.includes('x-mpegURL') || urlParam.includes('.m3u8')

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 'no-store')

    if (isPlaylist) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl')
      const text = await upstream.text()
      res.send(rewriteM3u8(text, urlParam, referer))
    } else {
      res.setHeader('Content-Type', ct || 'application/octet-stream')
      const buf = await upstream.arrayBuffer()
      res.send(Buffer.from(buf))
    }
  } catch (e) {
    console.error('[sports/proxy]', e)
    res.status(502).json({ error: 'Proxy error' })
  }
})
