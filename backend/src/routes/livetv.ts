import { Router } from 'express'

export const livetvRouter = Router()

// English-speaking country playlists from iptv-org (direct .m3u8 live TV).
// We keep only Sports/News channels, and only ones that pass a live health-check —
// so users see recognizable English channels, not foreign-language clutter.
const COUNTRIES = ['us', 'uk', 'ca', 'au', 'nz', 'ie']
const PLAYLIST = (c: string) => `https://iptv-org.github.io/iptv/countries/${c}.m3u`

// India has 230+ news channels, mostly regional languages — so instead of the whole
// playlist we allow only recognizable Hindi/national channels (DD + major networks).
const INDIA_ALLOW = /\b(DD Sports|DD National|DD India|DD News|DD Bharati|Sansad TV|Aaj Tak|ABP News|Zee News|Zee Hindustan|NDTV|India TV|News18 India|Republic Bharat|WION|Times Now|CNBC Awaaz|TV9 Bharatvarsh|News Nation|Bharat24)\b/i
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
const ORIGIN = 'https://watchmovora.com'

const REFRESH_MS = 20 * 60 * 1000
const CHECK_CONCURRENCY = 12
const CHECK_TIMEOUT = 6_000

type Group = 'Sports' | 'News' | 'Hindi'

interface Channel {
  id: string          // base64url(url) — self-contained, no server lookup needed
  name: string
  logo: string | null
  group: Group
  url: string
  direct: boolean     // CORS-enabled → player can stream client-side (0 Render bandwidth)
}

let channelsCache: Channel[] = []
let lastRefresh = 0
let refreshing = false

function b64url(s: string): string {
  return Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function cleanName(raw: string): string {
  return raw.replace(/\s*\((?:\d+p|[^)]*)\)/gi, '').replace(/\s*\[[^\]]*\]/g, '').trim() || raw.trim()
}

// Collapse iptv-org's messy multi-group titles ("Auto;Outdoor;Sports") to one clean bucket.
function normalizeGroup(group: string): 'Sports' | 'News' | null {
  const g = group.toLowerCase()
  if (/news/.test(g)) return 'News'
  if (/sport/.test(g)) return 'Sports'
  return null
}

interface ParsedChannel { name: string; logo: string | null; group: Group; url: string }

// Parse an M3U. `mode='english'` keeps Sports/News by group-title; `mode='india'`
// keeps only allowlisted channels (any group) and buckets them Sports vs Hindi.
function parseM3U(text: string, mode: 'english' | 'india'): ParsedChannel[] {
  const out: ParsedChannel[] = []
  const lines = text.split('\n')
  let pending: { name: string; logo: string | null; group: Group } | null = null

  for (const line of lines) {
    const t = line.trim()
    if (t.startsWith('#EXTINF')) {
      const rawGroup = /group-title="([^"]*)"/.exec(t)?.[1] || ''
      const logo = /tvg-logo="([^"]*)"/.exec(t)?.[1] || null
      const name = cleanName(t.slice(t.lastIndexOf(',') + 1).trim())
      let group: Group | null = null
      if (mode === 'india') {
        if (INDIA_ALLOW.test(name)) group = /sport/i.test(name) ? 'Sports' : 'Hindi'
      } else {
        group = normalizeGroup(rawGroup)
      }
      pending = group ? { name, logo, group } : null
    } else if (t.startsWith('#')) {
      // skip #EXTVLCOPT and other directives, keep pending
    } else if (t) {
      if (pending && t.includes('.m3u8')) out.push({ ...pending, url: t })
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
    return { alive, direct: alive && (acao === '*' || acao === ORIGIN) }
  } catch {
    return { alive: false, direct: false }
  }
}

async function mapPool<T, R>(items: T[], fn: (t: T) => Promise<R>, n: number): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) { const idx = i++; results[idx] = await fn(items[idx]) }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, () => worker()))
  return results
}

async function refresh(): Promise<void> {
  if (refreshing) return
  refreshing = true
  try {
    // English countries → Sports/News by group; India → allowlisted Hindi/DD only.
    const fetchText = async (url: string) => {
      try {
        const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) })
        return r.ok ? await r.text() : ''
      } catch { return '' }
    }
    const engTexts = await Promise.all(COUNTRIES.map(c => fetchText(PLAYLIST(c))))
    const indiaText = await fetchText(PLAYLIST('in'))

    const byName = new Map<string, ParsedChannel>()
    const add = (chs: ParsedChannel[]) => {
      for (const ch of chs) {
        const key = ch.name.toLowerCase()
        if (!byName.has(key)) byName.set(key, ch)
      }
    }
    for (const text of engTexts) add(parseM3U(text, 'english'))
    add(parseM3U(indiaText, 'india'))
    const parsed = [...byName.values()]

    const checked = await mapPool(parsed, async ch => {
      const { alive, direct } = await checkChannel(ch.url)
      return { ch, alive, direct }
    }, CHECK_CONCURRENCY)

    channelsCache = checked
      .filter(c => c.alive)
      .map(c => ({ id: b64url(c.ch.url), name: c.ch.name, logo: c.ch.logo, group: c.ch.group, url: c.ch.url, direct: c.direct }))
      .sort((a, b) => a.group === b.group ? a.name.localeCompare(b.name) : a.group.localeCompare(b.group))

    lastRefresh = Date.now()
    console.log(`[livetv] refreshed: ${channelsCache.length}/${parsed.length} English Sports/News channels live`)
  } catch (e) {
    console.error('[livetv] refresh failed', e)
  } finally {
    refreshing = false
  }
}

// ─── Endpoints ───────────────────────────────────────────────────────────────
livetvRouter.get('/channels', (_req, res) => {
  if (Date.now() - lastRefresh > REFRESH_MS && !refreshing) void refresh()
  res.json({ channels: channelsCache, updatedAt: lastRefresh, refreshing: refreshing && channelsCache.length === 0 })
})

void refresh()
setInterval(() => void refresh(), REFRESH_MS)
