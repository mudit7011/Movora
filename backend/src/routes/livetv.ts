import { Router } from 'express'

export const livetvRouter = Router()

// iptv-org public sports channel playlist (direct .m3u8 live TV).
// Only channels that pass a live health-check are ever served to the client.
const PLAYLIST_URL = 'https://iptv-org.github.io/iptv/categories/sports.m3u'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
const ORIGIN = 'https://watchmovora.com'

const REFRESH_MS = 20 * 60 * 1000   // re-check every 20 min (status fluctuates)
const CHECK_CONCURRENCY = 12
const CHECK_TIMEOUT = 6_000

interface Channel {
  id: string          // base64url(url) — self-contained, no server lookup needed
  name: string
  logo: string | null
  group: string
  url: string
  direct: boolean     // CORS-enabled → player can stream client-side (0 Render bandwidth)
}

let channelsCache: Channel[] = []
let lastRefresh = 0
let refreshing = false

function b64url(s: string): string {
  return Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Clean the "Name (1080p) [Not 24/7]" label down to a readable channel name.
function cleanName(raw: string): string {
  return raw.replace(/\s*\((?:\d+p|[^)]*)\)/gi, '').replace(/\s*\[[^\]]*\]/g, '').trim() || raw.trim()
}

interface ParsedChannel { name: string; logo: string | null; group: string; url: string }

function parseM3U(text: string): ParsedChannel[] {
  const out: ParsedChannel[] = []
  const lines = text.split('\n')
  let pending: { name: string; logo: string | null; group: string } | null = null

  for (const line of lines) {
    const t = line.trim()
    if (t.startsWith('#EXTINF')) {
      const logo = /tvg-logo="([^"]*)"/.exec(t)?.[1] || null
      const group = /group-title="([^"]*)"/.exec(t)?.[1] || 'Sports'
      const name = t.slice(t.lastIndexOf(',') + 1).trim()
      pending = { name: cleanName(name), logo, group }
    } else if (t && !t.startsWith('#')) {
      if (pending && t.includes('.m3u8')) {   // only HLS — avoids pulling raw video during health-check
        out.push({ ...pending, url: t })
      }
      pending = null
    }
  }
  return out
}

async function checkChannel(url: string): Promise<{ alive: boolean; direct: boolean }> {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Origin': ORIGIN, 'Referer': ORIGIN },
      signal: AbortSignal.timeout(CHECK_TIMEOUT),
    })
    if (!r.ok) return { alive: false, direct: false }
    const ct = r.headers.get('content-type') || ''
    const text = await r.text()
    const alive = text.includes('#EXTM3U') || ct.includes('mpegurl')
    const acao = r.headers.get('access-control-allow-origin')
    const direct = alive && (acao === '*' || acao === ORIGIN)
    return { alive, direct }
  } catch {
    return { alive: false, direct: false }
  }
}

// Bounded-concurrency map so we don't fire 400+ requests at once.
async function mapPool<T, R>(items: T[], fn: (t: T) => Promise<R>, n: number): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, () => worker()))
  return results
}

async function refresh(): Promise<void> {
  if (refreshing) return
  refreshing = true
  try {
    const r = await fetch(PLAYLIST_URL, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) })
    if (!r.ok) { console.error('[livetv] playlist fetch', r.status); return }
    const parsed = parseM3U(await r.text())

    const checked = await mapPool(parsed, async ch => {
      const { alive, direct } = await checkChannel(ch.url)
      return { ch, alive, direct }
    }, CHECK_CONCURRENCY)

    const alive: Channel[] = checked
      .filter(c => c.alive)
      .map(c => ({ id: b64url(c.ch.url), name: c.ch.name, logo: c.ch.logo, group: c.ch.group, url: c.ch.url, direct: c.direct }))
      // de-dupe by name (playlist lists many mirrors of the same channel)
      .filter((c, i, arr) => arr.findIndex(x => x.name.toLowerCase() === c.name.toLowerCase()) === i)

    channelsCache = alive
    lastRefresh = Date.now()
    console.log(`[livetv] refreshed: ${alive.length}/${parsed.length} channels live`)
  } catch (e) {
    console.error('[livetv] refresh failed', e)
  } finally {
    refreshing = false
  }
}

// ─── Endpoints ───────────────────────────────────────────────────────────────
livetvRouter.get('/channels', (_req, res) => {
  // Refresh in the background if the cache is stale; serve whatever we have now.
  if (Date.now() - lastRefresh > REFRESH_MS && !refreshing) void refresh()
  res.json({ channels: channelsCache, updatedAt: lastRefresh, refreshing: refreshing && channelsCache.length === 0 })
})

// Warm the cache on boot + keep it fresh. UptimeRobot keeps Render awake so this persists.
void refresh()
setInterval(() => void refresh(), REFRESH_MS)
