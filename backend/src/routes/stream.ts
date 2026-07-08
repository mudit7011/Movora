import { Router } from 'express'
import crypto from 'crypto'
import { tmdbFetch } from '../utils/tmdb'
import { getMovieBoxSources } from './moviebox'

export const streamRouter = Router()

// ─── VidZee m3u8 extractor ────────────────────────────────────────────────────
// Two-stage AES: (1) fetch an encrypted dynamic key from core.vidzee.wtf/api-key and
// decrypt it with AES-256-GCM (hardcoded key); (2) use that key to AES-256-CBC decrypt
// each server's obfuscated `link` into a real .m3u8 URL. Returns direct HLS sources by
// TMDB id — played in our own player (proxied via /api/sports/proxy for the Referer).
//
// NOTE: if VidZee rotates ENCRYPTION_KEY or the algorithm, extraction breaks and this
// block must be updated (track community repos, e.g. Inside4ndroid/PyEmbed-Api).

const ENCRYPTION_KEY = 'c4a8f1d7e2b9a6c3d0f5e8a1b7c4d9e2'
const KEY_URL = 'https://core.vidzee.wtf/api-key'
const SERVER_BASE = 'https://player.vidzee.wtf/api/server'
const REFERER = 'https://player.vidzee.wtf/'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const SERVER_IDS = Array.from({ length: 14 }, (_, i) => i) // sr 0..13

const H = { 'User-Agent': UA, 'Referer': REFERER, 'Accept': 'application/json, text/plain, */*' }

// ─── ShowBox / FebBox extractor (high quality + original & dubbed audio) ───────
// TMDB → ShowBox id (via CF-bypass proxy) → FebBox share → file list → per-file
// quality links (up to 4K, one file per audio language). Needs a FebBox `ui` token.
const FEBBOX_UI = process.env.FEBBOX_UI_TOKEN || ''
const SHOWBOX_API = 'https://id-mapping-api-showbox-proxy.hf.space/api/media'
const FEBBOX = 'https://www.febbox.com'
const FEBBOX_REFERER = 'https://www.febbox.com/'
// FebBox fingerprints request headers — a minimal set gets a 500 ("系统发生错误")
// ThinkPHP error page for every path. A full realistic browser header set (client
// hints + Sec-Fetch + XHR marker) is required or extraction silently fails.
const fbHeaders = (cookie?: string) => ({
  'User-Agent': UA,
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'sec-ch-ua': '"Chromium";v="131", "Not_A Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'X-Requested-With': 'XMLHttpRequest',
  'Referer': FEBBOX_REFERER,
  ...(cookie ? { Cookie: cookie } : {}),
})
const LANG_RE = /\b(hindi|english|tamil|telugu|spanish|french|german|arabic|japanese|korean|italian|portuguese|russian|dual\s*audio|multi)\b/i

function detectLang(name: string): string {
  const m = LANG_RE.exec(name || '')
  return m ? m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() : ''
}

// ─── Title verification ───────────────────────────────────────────────────────
// The TMDB→ShowBox id-mapping proxy sometimes returns a WRONG id (e.g. tmdb 243206
// "Pritam and Pedro" → ShowBox 29369 which is actually "Robin's Wish 2020"). Without a
// check we'd serve the wrong film. Compare the expected TMDB title against the FebBox
// filenames and reject clear mismatches.
async function tmdbTitle(tmdb: string, type: string): Promise<string> {
  try {
    const d: any = await tmdbFetch(`/${type === 'tv' ? 'tv' : 'movie'}/${tmdb}?language=en-US`)
    return (type === 'tv' ? d?.name : d?.title) || d?.original_title || d?.original_name || ''
  } catch { return '' }
}
const TITLE_STOP = new Set(['the', 'and', 'part', 'season', 'episode', 'movie', 'series'])
function titleMatches(expected: string, filename: string): boolean {
  const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')
  const words = norm(expected).split(' ').filter(w => w.length >= 4 && !TITLE_STOP.has(w))
  if (words.length === 0) return true                    // nothing distinctive → can't verify, allow
  const fn = norm(filename)
  return words.some(w => fn.includes(w))
}

interface Source { server: string; lang: string; url: string; referer: string; type: 'hls' | 'mp4' | 'dash' }

// ─── Hardened play tokens (encrypted, short-lived) ────────────────────────────
// The real CDN URL + referer are sealed inside an AES-256-GCM token, so the browser
// never sees the upstream stream URL. A copied link is opaque (can't be decoded to the
// source), expires quickly, and only resolves through our own proxy — so it can't be
// hotlinked, scraped, or replayed elsewhere. This is the practical ceiling for an
// aggregator (true Netflix-grade needs DRM, which requires owning the encrypted content).
const STREAM_SECRET = crypto.createHash('sha256')
  .update(process.env.STREAM_SECRET || crypto.randomBytes(32)).digest()
const TOKEN_TTL = 3 * 60 * 60 * 1000   // 3h — covers a full movie; segments are re-sealed live

function seal(u: string, r: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', STREAM_SECRET, iv)
  const pt = Buffer.from(JSON.stringify({ u, r, e: Date.now() + TOKEN_TTL }))
  const ct = Buffer.concat([cipher.update(pt), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64url')
}
function unseal(token: string): { u: string; r: string } | null {
  try {
    const raw = Buffer.from(token, 'base64url')
    if (raw.length < 29) return null
    const d = crypto.createDecipheriv('aes-256-gcm', STREAM_SECRET, raw.subarray(0, 12))
    d.setAuthTag(raw.subarray(12, 28))
    const obj = JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8'))
    if (!obj?.u || !obj?.e || Date.now() > obj.e) return null
    return { u: obj.u, r: obj.r || '' }
  } catch { return null }
}
const playUrl = (u: string, r: string) => `/api/stream/hls?d=${seal(u, r)}`

// SSRF guard — only external https hosts, never private/loopback ranges.
const PRIVATE_IP = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1$|fc|fd|169\.254\.)/i
function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && u.hostname.includes('.') && !PRIVATE_IP.test(u.hostname)
  } catch { return false }
}

// CDNs verified to serve video segments straight to the browser (CORS: *, no referer lock, honor
// Range). Emitting their real URL directly in the media playlist means the heavy video bytes go
// browser→CDN and NEVER through our proxy — so playback is smooth AND it scales to thousands of
// concurrent viewers (our server only ever serves tiny text playlists). The master + variant
// playlists still flow sealed, so the scraped source .m3u8 stays hidden; only individual, short-
// lived chunk URLs are exposed (the same trade every streaming site makes).
const SAFE_DIRECT_HOSTS = /(^|\.)shegu\.net$|(^|\.)klcxm\.com$|(^|\.)wnowe\.com$/i
function directOk(raw: string): boolean {
  try { return SAFE_DIRECT_HOSTS.test(new URL(raw).hostname) } catch { return false }
}

// Rewrite an m3u8: child playlists + keys become sealed tokens (hidden), but video segments on a
// safe CDN are emitted as their real URL so the browser fetches them directly (smooth + scalable).
function rewriteSealed(content: string, baseUrl: string, referer: string): string {
  const base = new URL(baseUrl)
  const isMedia = content.includes('#EXTINF')   // media playlist → bare lines are video segments
  const mk = (uri: string, seg = false) => {
    let abs: string
    try { abs = new URL(uri, base).href } catch { return uri }
    if (seg && directOk(abs)) return abs        // direct-to-CDN segment (no proxy hop)
    return playUrl(abs, referer)
  }
  return content.split('\n').map(line => {
    const t = line.trim()
    if (!t) return line
    // Keys / init-segments / audio tracks always proxy (never expose a decryption key).
    if (t.startsWith('#EXT-X-KEY') || t.startsWith('#EXT-X-MAP') || t.startsWith('#EXT-X-MEDIA'))
      return line.replace(/URI="([^"]+)"/, (_, u) => `URI="${mk(u, false)}"`)
    // A bare line inside a media playlist is a video segment → eligible for direct-CDN.
    if (!t.startsWith('#')) return mk(t, isMedia)
    return line
  }).join('\n')
}

// ─── Stage 1: dynamic api-key (AES-256-GCM), cached 1h ────────────────────────
let apiKeyCache: { key: string; ts: number } | null = null
const KEY_TTL = 60 * 60 * 1000

async function getApiKey(): Promise<string | null> {
  if (apiKeyCache && Date.now() - apiKeyCache.ts < KEY_TTL) return apiKeyCache.key
  try {
    const r = await fetch(KEY_URL, { headers: H, signal: AbortSignal.timeout(10_000) })
    if (!r.ok) return null
    const raw = Buffer.from((await r.text()).trim(), 'base64')
    if (raw.length <= 28) return null
    const iv = raw.subarray(0, 12)
    const tag = raw.subarray(12, 28)
    const ct = raw.subarray(28)
    const keyHash = crypto.createHash('sha256').update(ENCRYPTION_KEY, 'utf8').digest()
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyHash, iv)
    decipher.setAuthTag(tag)
    const key = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
    apiKeyCache = { key, ts: Date.now() }
    return key
  } catch {
    return null
  }
}

// ─── Stage 2: decrypt a server's obfuscated link (AES-256-CBC) ────────────────
function decryptLink(link: string, apiKey: string): string | null {
  try {
    const decoded = Buffer.from(link, 'base64').toString('utf8') // ivB64:cipherB64
    const i = decoded.indexOf(':')
    if (i === -1) return null
    const iv = Buffer.from(decoded.slice(0, i), 'base64')
    const ct = Buffer.from(decoded.slice(i + 1), 'base64')
    const key = Buffer.alloc(32)
    Buffer.from(apiKey, 'utf8').copy(key) // ljust(32, \0)[:32]
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    const out = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
    return /^https?:\/\//i.test(out) ? out.trim() : null
  } catch {
    return null
  }
}

async function fetchServer(sr: number, params: string, apiKey: string): Promise<Source[]> {
  try {
    const r = await fetch(`${SERVER_BASE}?${params}&sr=${sr}`, { headers: H, signal: AbortSignal.timeout(5_000) })
    if (!r.ok) return []
    const d: any = await r.json()
    const provider = d?.provider || `Server ${sr}`
    const out: Source[] = []
    for (const item of (d?.url || [])) {
      const link = typeof item === 'string' ? item : item?.link
      const lang = (typeof item === 'object' && (item?.lang || item?.label)) || 'Original'
      if (!link) continue
      const url = /^https?:\/\//i.test(link) ? link : decryptLink(link, apiKey)
      if (!url) continue
      out.push({ server: provider, lang, url, referer: REFERER, type: url.includes('.m3u8') ? 'hls' : 'mp4' })
    }
    return out
  } catch {
    return []
  }
}

// FebBox + the id proxy intermittently rate-limit / return a 500 ThinkPHP page from datacenter
// IPs (Render). Without retries, a single transient failure at any step drops ALL ShowBox sources
// (→ no quality options in prod). Retry a few times with backoff; a rate-limit 500 comes back fast,
// so retrying is cheap, and it recovers most transient failures.
async function fbFetchJson(url: string, headers: any, tries = 3): Promise<any | null> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(7_000) })
      if (r.ok) { const j = await r.json().catch(() => null); if (j) return j }
    } catch { /* timeout / connection reset — fall through to retry */ }
    if (i < tries - 1) await new Promise(res => setTimeout(res, 350 * (i + 1)))
  }
  return null
}

async function getShowboxSources(tmdb: string, type: string, season: string, episode: string): Promise<Source[]> {
  if (!FEBBOX_UI) return []
  const cookie = FEBBOX_UI.startsWith('ui=') ? FEBBOX_UI : `ui=${FEBBOX_UI}`
  const titleP = tmdbTitle(tmdb, type)   // fetch expected title in parallel for verification
  try {
    // 1) TMDB → ShowBox id (proxy handles ShowBox's Cloudflare)
    const idUrl = type === 'tv'
      ? `${SHOWBOX_API}/tv/${tmdb}/${season}/${episode}?cookie=${encodeURIComponent(FEBBOX_UI)}`
      : `${SHOWBOX_API}/movie/${tmdb}?cookie=${encodeURIComponent(FEBBOX_UI)}`
    const idData: any = await fbFetchJson(idUrl, fbHeaders())
    const showboxId = idData?.id || idData?.mid || idData?.data?.id || idData?.data?.mid
    if (!showboxId) return []

    // 2) ShowBox id → FebBox share key
    const boxType = type === 'tv' ? 2 : 1
    const shData: any = await fbFetchJson(`${FEBBOX}/mbp/to_share_page?box_type=${boxType}&mid=${showboxId}&json=1`, fbHeaders())
    const shareLink = shData?.code === 1 ? (shData.data?.share_link || shData.data?.shareLink) : null
    if (!shareLink) return []
    const shareKey = String(shareLink).split('/').filter(Boolean).pop()

    // 3) file list (auth by ui cookie); for TV, descend into the season folder
    const listFiles = async (parentId?: string) => {
      const u = `${FEBBOX}/file/file_share_list?share_key=${shareKey}${parentId ? `&parent_id=${parentId}&page=1` : ''}`
      const d: any = await fbFetchJson(u, fbHeaders(cookie))
      return d?.code === 1 ? (d.data?.file_list || []) : []
    }
    let files: any[] = await listFiles()

    // Verify the share matches the requested title before trusting it (guards against the
    // proxy returning a wrong ShowBox id → wrong movie). Movies: root files carry the title.
    const expectedTitle = await titleP
    if (type !== 'tv' && expectedTitle && files.length > 0 && !files.some((f: any) => titleMatches(expectedTitle, f.file_name))) {
      console.warn(`[ShowBox] title mismatch — expected "${expectedTitle}", got "${files[0]?.file_name}". Rejecting wrong id ${showboxId}.`)
      return []
    }

    if (type === 'tv') {
      const folder = files.find((f: any) => f.file_name?.toLowerCase() === `season ${season}`)
      if (!folder) return []
      const eps: any[] = await listFiles(folder.fid)
      const ss = season.padStart(2, '0'), ee = episode.padStart(2, '0')
      files = eps.filter((f: any) => {
        const n = (f.file_name || '').toLowerCase()
        return n.includes(`s${ss}e${ee}`) || n.includes(`s${season}e${episode}`)
      })
      // For TV, episode filenames usually contain the show name — reject a clearly wrong share.
      if (expectedTitle && files.length > 0 && !files.some((f: any) => titleMatches(expectedTitle, f.file_name))) {
        console.warn(`[ShowBox] TV title mismatch — expected "${expectedTitle}", got "${files[0]?.file_name}". Rejecting.`)
        return []
      }
    }
    files = files.filter((f: any) => f.fid && !f.is_dir && /\.(mp4|mkv|avi|m3u8)$/i.test(f.file_name || '')).slice(0, 3)

    // 4) per file → quality links, fetched IN PARALLEL (was a sequential loop → slow cold start).
    const RANK: Record<string, number> = { '2160P': 4, '4K': 4, '1080P': 3, '720P': 2, '480P': 1, '360P': 0 }
    const perFile = await Promise.all(files.map(async (f: any): Promise<Source[]> => {
      try {
        const qData: any = await fbFetchJson(`${FEBBOX}/console/video_quality_list?fid=${f.fid}&share_key=${shareKey}`, fbHeaders(cookie))
        const html: string = qData?.code === 1 ? (qData.html || '') : ''
        const lang = detectLang(f.file_name)
        // Best-first (2160/1080 → 360). Skip raw "ORG" .original downloads (often unplayable MKV).
        const fileSources: (Source & { rank: number })[] = []
        for (const block of html.split('file_quality').slice(1)) {
          const url = /data-url="([^"]+)"/.exec(block)?.[1]
          const qual = (/data-quality="([^"]+)"/.exec(block)?.[1] || 'HD').toUpperCase()
          if (!url || !/^https?:\/\//i.test(url)) continue
          const isHls = url.includes('.m3u8')
          if (!isHls && !/\.(mp4|mkv)(\?|$)/i.test(url)) continue
          fileSources.push({ server: 'ShowBox', lang: `${qual}${lang ? ' · ' + lang : ''}`, url, referer: FEBBOX_REFERER, type: isHls ? 'hls' : 'mp4', rank: RANK[qual] ?? 2 })
        }
        fileSources.sort((a, b) => b.rank - a.rank)
        return fileSources.map(({ rank, ...src }) => src)
      } catch { return [] }
    }))
    return perFile.flat()
  } catch {
    return []
  }
}

// ─── OSDb moviehash (for byte-exact subtitle sync) ────────────────────────────
// OpenSubtitles tags each subtitle with the "moviehash" of the exact file it was synced to.
// It's a cheap fingerprint: filesize + sum of the first 64KB + sum of the last 64KB (as LE
// uint64s). FebBox exposes the untouched ORG release file, so we range-fetch just ~128KB of it
// and compute the hash — then OpenSubtitles can hand back a subtitle guaranteed in-sync. Best
// effort: a miss (obscure encode / no ORG) just falls back to the ranked search results.
function osdbHash(head: Buffer, tail: Buffer, size: number): string {
  const MASK = (1n << 64n) - 1n
  let h = BigInt(size) & MASK
  for (let i = 0; i + 8 <= head.length; i += 8) h = (h + head.readBigUInt64LE(i)) & MASK
  for (let i = 0; i + 8 <= tail.length; i += 8) h = (h + tail.readBigUInt64LE(i)) & MASK
  return h.toString(16).padStart(16, '0')
}

async function osdbHashFromUrl(url: string, cookie: string): Promise<string | null> {
  try {
    const hdr = { 'User-Agent': UA, Referer: FEBBOX_REFERER, Cookie: cookie }
    const headR = await fetch(url, { headers: { ...hdr, Range: 'bytes=0-65535' }, redirect: 'follow', signal: AbortSignal.timeout(6_000) })
    if (!headR.ok && headR.status !== 206) return null
    const cr = headR.headers.get('content-range')             // "bytes 0-65535/12345678"
    const size = cr ? Number(cr.split('/')[1]) : Number(headR.headers.get('content-length') || 0)
    if (!size || size < 131072) return null                    // too small / unknown size
    const head = Buffer.from(await headR.arrayBuffer())
    const tailR = await fetch(url, { headers: { ...hdr, Range: `bytes=${size - 65536}-${size - 1}` }, redirect: 'follow', signal: AbortSignal.timeout(6_000) })
    if (!tailR.ok && tailR.status !== 206) return null
    const tail = Buffer.from(await tailR.arrayBuffer())
    if (head.length < 65536 || tail.length < 65536) return null
    return osdbHash(head, tail, size)
  } catch { return null }
}

const hashCache = new Map<string, { hash: string | null; ts: number }>()
const HASH_TTL = 6 * 60 * 60 * 1000   // cache hits and misses 6h (the ORG file rarely changes)

// Resolve the FebBox ORG file for a title and return its OSDb moviehash (or null). Lean, self-
// contained resolver (no title verification — a wrong id simply won't hash-match any subtitle).
export async function getMovieHash(tmdb: string, type: string, season: string, episode: string): Promise<string | null> {
  if (!FEBBOX_UI) return null
  const key = `${type}:${tmdb}:${season}:${episode}`
  const hit = hashCache.get(key)
  if (hit && Date.now() - hit.ts < HASH_TTL) return hit.hash
  const put = (h: string | null) => { hashCache.set(key, { hash: h, ts: Date.now() }); return h }
  const cookie = FEBBOX_UI.startsWith('ui=') ? FEBBOX_UI : `ui=${FEBBOX_UI}`
  const T = 8_000
  try {
    const idUrl = type === 'tv'
      ? `${SHOWBOX_API}/tv/${tmdb}/${season}/${episode}?cookie=${encodeURIComponent(FEBBOX_UI)}`
      : `${SHOWBOX_API}/movie/${tmdb}?cookie=${encodeURIComponent(FEBBOX_UI)}`
    const idr = await fetch(idUrl, { headers: fbHeaders(), signal: AbortSignal.timeout(T) })
    if (!idr.ok) return put(null)
    const idData: any = await idr.json()
    const showboxId = idData?.id || idData?.mid || idData?.data?.id || idData?.data?.mid
    if (!showboxId) return put(null)

    const boxType = type === 'tv' ? 2 : 1
    const shr = await fetch(`${FEBBOX}/mbp/to_share_page?box_type=${boxType}&mid=${showboxId}&json=1`, { headers: fbHeaders(), signal: AbortSignal.timeout(T) })
    const shData: any = await shr.json().catch(() => null)
    const shareLink = shData?.code === 1 ? (shData.data?.share_link || shData.data?.shareLink) : null
    if (!shareLink) return put(null)
    const shareKey = String(shareLink).split('/').filter(Boolean).pop()

    const listFiles = async (parentId?: string) => {
      const u = `${FEBBOX}/file/file_share_list?share_key=${shareKey}${parentId ? `&parent_id=${parentId}&page=1` : ''}`
      const r = await fetch(u, { headers: fbHeaders(cookie), signal: AbortSignal.timeout(T) })
      const d: any = await r.json().catch(() => null)
      return d?.code === 1 ? (d.data?.file_list || []) : []
    }
    let files: any[] = await listFiles()
    if (type === 'tv') {
      const folder = files.find((f: any) => f.file_name?.toLowerCase() === `season ${season}`)
      if (!folder) return put(null)
      const eps: any[] = await listFiles(folder.fid)
      const ss = season.padStart(2, '0'), ee = episode.padStart(2, '0')
      files = eps.filter((f: any) => {
        const n = (f.file_name || '').toLowerCase()
        return n.includes(`s${ss}e${ee}`) || n.includes(`s${season}e${episode}`)
      })
    }
    const file = files.find((f: any) => f.fid && !f.is_dir && /\.(mp4|mkv|avi)$/i.test(f.file_name || ''))
    if (!file) return put(null)

    // ORG = the untouched release file that community subs were synced against.
    const qr = await fetch(`${FEBBOX}/console/video_quality_list?fid=${file.fid}&share_key=${shareKey}`, { headers: fbHeaders(cookie), signal: AbortSignal.timeout(8_000) })
    const qData: any = await qr.json().catch(() => null)
    const html: string = qData?.code === 1 ? (qData.html || '') : ''
    let orgUrl: string | null = null
    for (const block of html.split('file_quality').slice(1)) {
      const u = /data-url="([^"]+)"/.exec(block)?.[1]
      const qual = (/data-quality="([^"]+)"/.exec(block)?.[1] || '').toUpperCase()
      if (u && /^https?:\/\//i.test(u) && qual === 'ORG' && /\.(mp4|mkv|avi)(\?|$)/i.test(u)) { orgUrl = u; break }
    }
    if (!orgUrl) return put(null)
    return put(await osdbHashFromUrl(orgUrl, cookie))
  } catch { return put(null) }
}

// ─── Endpoint ─────────────────────────────────────────────────────────────────
// Cache resolved sources per key for 5 min (links are time-limited but short reuse is fine).
const srcCache = new Map<string, { data: Source[]; ts: number }>()
const SRC_TTL = 5 * 60 * 1000

streamRouter.get('/', async (req, res) => {
  const tmdb = String(req.query.tmdb || req.query.id || '')
  const type = String(req.query.type || 'movie')
  const season = req.query.season ? String(req.query.season) : ''
  const episode = req.query.episode ? String(req.query.episode) : ''

  if (!tmdb) { res.status(400).json({ error: 'tmdb id required' }); return }

  const cacheKey = `${type}:${tmdb}:${season}:${episode}`
  const hit = srcCache.get(cacheKey)
  if (hit && Date.now() - hit.ts < SRC_TTL) { res.json({ sources: sealAll(hit.data) }); return }

  let params = `id=${encodeURIComponent(tmdb)}`
  if (type === 'tv' && season && episode) params += `&ss=${encodeURIComponent(season)}&ep=${encodeURIComponent(episode)}`

  // Run ShowBox/FebBox and all vidzee servers fully concurrently (previously ShowBox THEN
  // vidzee ran sequentially → ~7s cold). ShowBox starts immediately; vidzee needs the api key.
  const showboxP = getShowboxSources(tmdb, type, season, episode)
  // MovieBox (HD DASH) — fills the gap where FebBox only has 360p (new seasons / HEVC titles).
  const mbP = tmdbTitle(tmdb, type).then(t => getMovieBoxSources(type, season, episode, t)).catch(() => [])
  const apiKey = await getApiKey()
  const vidzeeP = apiKey ? Promise.all(SERVER_IDS.map(sr => fetchServer(sr, params, apiKey))) : Promise.resolve([] as Source[][])
  const [showboxSources, vidzeeResults, mbSources] = await Promise.all([showboxP, vidzeeP, mbP])

  const seen = new Set<string>()
  const sources: Source[] = []
  for (const s of showboxSources) { if (!seen.has(s.url)) { seen.add(s.url); sources.push(s) } }        // ShowBox first
  for (const s of mbSources) { if (!seen.has(s.url)) { seen.add(s.url); sources.push(s as Source) } }   // MovieBox HD
  for (const list of vidzeeResults) for (const s of list) { if (!seen.has(s.url)) { seen.add(s.url); sources.push(s) } }

  if (sources.length === 0) { res.status(502).json({ error: 'no sources', sources: [] }); return }

  srcCache.set(cacheKey, { data: sources, ts: Date.now() })
  if (srcCache.size > 300) {
    const oldest = [...srcCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0]
    srcCache.delete(oldest[0])
  }
  res.json({ sources: sealAll(sources) })
})

// Only expose sealed play tokens to the client — never the real CDN url/referer. MovieBox 'dash'
// urls already point at our CF worker (which handles CORS + auth), so they pass through unsealed.
const sealAll = (list: Source[]) =>
  list.map(s => ({ server: s.server, lang: s.lang, type: s.type, url: s.type === 'dash' ? s.url : playUrl(s.url, s.referer) }))

// ─── Hardened HLS/segment proxy ───────────────────────────────────────────────
// Resolves a sealed token → real url (server-side only), fetches it with the right
// referer, and re-seals any child URLs. The browser only ever sees opaque tokens.
streamRouter.get('/hls', async (req, res) => {
  const dec = unseal(String(req.query.d || ''))
  if (!dec) { res.status(403).end(); return }
  if (!isSafeUrl(dec.u)) { res.status(400).end(); return }
  try {
    const range = req.headers.range
    const upstream = await fetch(dec.u, {
      headers: {
        'User-Agent': UA,
        'Referer': dec.r,
        'Origin': (() => { try { return new URL(dec.r).origin } catch { return dec.r } })(),
        ...(range ? { Range: range } : {}),
      },
      signal: AbortSignal.timeout(20_000),
    })
    if (!upstream.ok && upstream.status !== 206) { res.status(502).end(); return }

    const ct = upstream.headers.get('content-type') || ''
    const isPlaylist = ct.includes('mpegurl') || ct.includes('x-mpegURL') || /\.m3u8(\?|$)/i.test(dec.u)

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')

    if (isPlaylist) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl')
      res.send(rewriteSealed(await upstream.text(), upstream.url || dec.u, dec.r))
    } else {
      res.setHeader('Content-Type', ct || 'application/octet-stream')
      for (const h of ['content-range', 'accept-ranges', 'content-length']) {
        const v = upstream.headers.get(h); if (v) res.setHeader(h, v)
      }
      res.status(upstream.status)
      res.send(Buffer.from(await upstream.arrayBuffer()))
    }
  } catch {
    res.status(502).end()
  }
})

streamRouter.delete('/cache', (_req, res) => {
  srcCache.clear()
  apiKeyCache = null
  res.json({ ok: true })
})
