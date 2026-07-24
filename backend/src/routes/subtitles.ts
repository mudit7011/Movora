import { Router } from 'express'
import { getMovieHash } from './stream'
import { tmdbToAnilist } from './anime'

const router = Router()

// Official OpenSubtitles REST API. Its /download endpoint returns an authenticated CDN link
// that works from datacenter IPs (Render), unlike the free dl.opensubtitles.org scraping which
// 502s from datacenters. Set OPENSUBTITLES_API_KEY in the environment (local .env + Render).
const OS_KEY = process.env.OPENSUBTITLES_API_KEY || ''
const OS_BASE = 'https://api.opensubtitles.com/api/v1'
const OS_UA = 'Movora v1.0'   // OpenSubtitles requires a UA identifying the app

const osHeaders = (json = false) => ({
  'Api-Key': OS_KEY,
  'User-Agent': OS_UA,
  'Accept': 'application/json',
  ...(json ? { 'Content-Type': 'application/json' } : {}),
})

// language code → display name / flag country (OpenSubtitles uses codes like en, pt-BR, zh-CN)
const LANG_NAMES: Record<string, string> = {
  en: 'English', hi: 'Hindi', es: 'Spanish', 'es-mx': 'Spanish (LA)', fr: 'French', de: 'German',
  ar: 'Arabic', 'pt-br': 'Portuguese (BR)', 'pt-pt': 'Portuguese', pt: 'Portuguese', ru: 'Russian',
  ja: 'Japanese', ko: 'Korean', it: 'Italian', 'zh-cn': 'Chinese', 'zh-tw': 'Chinese (TW)', zh: 'Chinese',
  nl: 'Dutch', pl: 'Polish', tr: 'Turkish', sv: 'Swedish', da: 'Danish', no: 'Norwegian', fi: 'Finnish',
  cs: 'Czech', el: 'Greek', he: 'Hebrew', hu: 'Hungarian', ro: 'Romanian', id: 'Indonesian', th: 'Thai',
  vi: 'Vietnamese', uk: 'Ukrainian', bg: 'Bulgarian', hr: 'Croatian', sr: 'Serbian', sk: 'Slovak',
  sl: 'Slovenian', ms: 'Malay', fa: 'Persian', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam', bn: 'Bengali',
}
const LANG_FLAG: Record<string, string> = {
  en: 'US', hi: 'IN', es: 'ES', 'es-mx': 'MX', fr: 'FR', de: 'DE', ar: 'SA', 'pt-br': 'BR', 'pt-pt': 'PT',
  pt: 'PT', ru: 'RU', ja: 'JP', ko: 'KR', it: 'IT', 'zh-cn': 'CN', 'zh-tw': 'TW', zh: 'CN', nl: 'NL',
  pl: 'PL', tr: 'TR', sv: 'SE', da: 'DK', no: 'NO', fi: 'FI', cs: 'CZ', el: 'GR', he: 'IL', hu: 'HU',
  ro: 'RO', id: 'ID', th: 'TH', vi: 'VN', uk: 'UA', bg: 'BG', hr: 'HR', sr: 'RS', sk: 'SK', sl: 'SI',
  ms: 'MY', fa: 'IR', ta: 'IN', te: 'IN', ml: 'IN', bn: 'BD',
}
const displayName = (lang: string) => LANG_NAMES[lang.toLowerCase()] || lang.toUpperCase()
const flagUrl = (lang: string) => { const c = LANG_FLAG[lang.toLowerCase()]; return c ? `https://flagsapi.com/${c}/flat/24.png` : null }
function originOf(release: string): string {
  const s = (release || '').toLowerCase()
  if (/blu-?ray|bdrip|brrip/.test(s)) return 'BluRay'
  if (/web-?dl|webrip|\bweb\b|amzn|\bnf\b/.test(s)) return 'WEB'
  if (/hdrip|hdtv|hdts/.test(s)) return 'HDRip'
  return ''
}

interface SubOut { id: string; lang: string; display: string; flag: string | null; release: string; downloads: number; hi: boolean; origin: string }

// Map one OpenSubtitles API item → our SubOut shape.
function mapItem(item: any): SubOut {
  const a = item.attributes || {}
  const file = (a.files || [])[0] || {}
  const lang = String(a.language || '').toLowerCase()
  return {
    id: String(file.file_id || ''), lang, display: displayName(lang), flag: flagUrl(lang),
    release: a.release || file.file_name || '', downloads: Number(a.download_count || 0),
    hi: !!a.hearing_impaired, origin: originOf(a.release || ''),
  }
}

// Retry OpenSubtitles requests (its API intermittently resets/throttles); fresh timeout each try.
async function osFetch(url: string, opts: any = {}, tries = 3): Promise<Response | null> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(10_000) })
      if (r.ok) return r
      if (r.status === 429) { await new Promise(res => setTimeout(res, 600)); continue } // rate limited
      return r
    } catch { await new Promise(res => setTimeout(res, 400)) }
  }
  return null
}

// Cache search results per title (1h) so repeat views don't re-hit (and re-throttle) the API.
const searchCache = new Map<string, { data: SubOut[]; ts: number }>()
const SEARCH_TTL = 60 * 60 * 1000

// Cache the byte-exact (moviehash-matched) English sub per title so we resolve it once.
const hashSubCache = new Map<string, { sub: SubOut | null; ts: number }>()

// GET /api/subtitles/search?tmdb=&type=movie|tv&season=&episode=&all=1
// all=1 → every variant (most-downloaded first). Otherwise → one best per language.
router.get('/search', async (req, res) => {
  const tmdb = String(req.query.tmdb || req.query.tmdbId || '')
  const type = String(req.query.type || 'movie')
  const season = req.query.season ? String(req.query.season) : ''
  const episode = req.query.episode ? String(req.query.episode) : ''
  if (!tmdb || !OS_KEY) { res.json({ subtitles: [] }); return }

  const p = new URLSearchParams()
  if (type === 'tv' && season && episode) {
    p.set('parent_tmdb_id', tmdb); p.set('season_number', season); p.set('episode_number', episode)
  } else {
    p.set('tmdb_id', tmdb)
  }
  p.set('order_by', 'download_count'); p.set('order_direction', 'desc')

  const all = req.query.all === '1'
  const cacheKey = `${tmdb}:${type}:${season}:${episode}`
  const hit = searchCache.get(cacheKey)
  let mapped: SubOut[] | null = hit && Date.now() - hit.ts < SEARCH_TTL ? hit.data : null

  if (!mapped) {
    const r = await osFetch(`${OS_BASE}/subtitles?${p.toString()}`, { headers: osHeaders() })
    if (r && r.ok) {
      const d: any = await r.json().catch(() => null)
      let first: SubOut[] = ((d?.data) || []).map(mapItem).filter((s: SubOut) => s.id)
      // Anime absolute-episode fallback: long-running anime (One Piece etc.) are indexed on
      // OpenSubtitles by ABSOLUTE episode with no season (e.g. "S01E1089"), so parent+season+episode
      // returns 0. If this is anime and the normal search found nothing, retry without season_number.
      if (first.length === 0 && type === 'tv' && season && episode && await tmdbToAnilist(tmdb, 'tv', Number(season)).catch(() => null)) {
        const p2 = new URLSearchParams({ parent_tmdb_id: tmdb, episode_number: episode, order_by: 'download_count', order_direction: 'desc' })
        const r2 = await osFetch(`${OS_BASE}/subtitles?${p2.toString()}`, { headers: osHeaders() })
        if (r2 && r2.ok) {
          const d2: any = await r2.json().catch(() => null)
          first = ((d2?.data) || []).map(mapItem).filter((s: SubOut) => s.id)
        }
      }
      mapped = first
      searchCache.set(cacheKey, { data: mapped!, ts: Date.now() })
      if (searchCache.size > 500) { const o = [...searchCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0]; searchCache.delete(o[0]) }
    } else {
      mapped = hit ? hit.data : []   // serve stale on transient API failure
    }
  }

  let subtitles: SubOut[] = mapped ?? []   // API orders by download_count desc
  if (!all) {
    // Rank within a language: prefer WEB-DL (our ShowBox streams are WEB-DL transcodes, so these
    // sync best), then non-hearing-impaired (cleaner default), then raw download popularity.
    const pref = (s: SubOut) =>
      (s.origin === 'WEB' ? 2 : s.origin === 'BluRay' ? 1 : 0) * 1e12 +
      (s.hi ? 0 : 1e11) + s.downloads
    const byLang = new Map<string, SubOut[]>()
    for (const s of subtitles) { const arr = byLang.get(s.display); arr ? arr.push(s) : byLang.set(s.display, [s]) }

    const eng: SubOut[] = []
    const others: SubOut[] = []
    for (const [lang, arr] of byLang) {
      arr.sort((a, b) => pref(b) - pref(a))
      if (lang === 'English') {
        // Keep up to 3 distinct English variants so a mis-synced auto-pick is one tap away.
        arr.slice(0, 3).forEach((s, i) =>
          eng.push(i === 0 ? s : { ...s, display: s.origin ? `English (${s.origin})` : `English #${i + 1}` }))
      } else {
        others.push(arr[0])
      }
    }
    others.sort((a, b) => b.downloads - a.downloads)
    subtitles = [...eng, ...others]   // English first — it's auto-selected on the client
  }

  // Byte-exact sync: if we can OSDb-hash the ORG file, pin the moviehash-matched English sub to
  // the very top (guaranteed in-sync). Time-boxed so a slow ORG fetch never stalls the response —
  // the hash still resolves + caches in the background for the next load. Cached per title (1h).
  if (!all && OS_KEY) {
    let exact: SubOut | null | undefined
    const hHit = hashSubCache.get(cacheKey)
    if (hHit && Date.now() - hHit.ts < SEARCH_TTL) exact = hHit.sub
    if (exact === undefined) {
      exact = null
      const hash = await Promise.race([
        getMovieHash(tmdb, type, season, episode),
        new Promise<null>(r => setTimeout(() => r(null), 5000)),
      ]).catch(() => null)
      if (hash) {
        const hp = new URLSearchParams({ moviehash: hash, languages: 'en' })
        if (type === 'tv' && season && episode) { hp.set('parent_tmdb_id', tmdb); hp.set('season_number', season); hp.set('episode_number', episode) }
        else hp.set('tmdb_id', tmdb)
        const hr = await osFetch(`${OS_BASE}/subtitles?${hp.toString()}`, { headers: osHeaders() })
        if (hr && hr.ok) {
          const hd: any = await hr.json().catch(() => null)
          const match = ((hd?.data) || []).filter((it: any) => it.attributes?.moviehash_match).map(mapItem).filter((s: SubOut) => s.id)[0]
          if (match) exact = { ...match, display: 'English (exact sync)' }
        }
      }
      hashSubCache.set(cacheKey, { sub: exact ?? null, ts: Date.now() })
      if (hashSubCache.size > 500) { const o = [...hashSubCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0]; hashSubCache.delete(o[0]) }
    }
    if (exact) subtitles = [exact, ...subtitles.filter(s => s.id !== exact!.id)]
  }

  subtitles = subtitles.slice(0, all ? 150 : 30)
  res.setHeader('Cache-Control', 'public, max-age=300')
  res.json({ subtitles })
})

// Cache converted VTTs by file_id so we don't spend an OpenSubtitles download quota per view.
const vttCache = new Map<string, { vtt: string; ts: number }>()
const VTT_TTL = 24 * 60 * 60 * 1000

function srtToVtt(raw: string): string {
  let text = raw.replace(/\r/g, '').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
  const hadHeader = /^\s*WEBVTT/.test(text)
  // Strip common ad cues for a clean, premium look.
  const AD = /opensubtitles|osdb\.link|advertise your (product|brand)|watch online movies|api\.opensub|subscene|www\.\w+\.(org|com|link)/i
  const body = hadHeader ? text.replace(/^\s*WEBVTT[^\n]*\n/, '') : text
  const cleaned = body.split(/\n\s*\n/).filter(block => !AD.test(block)).join('\n\n')
  return 'WEBVTT\n\n' + cleaned.trim() + '\n'
}

// GET /api/subtitles/vtt?id={file_id}  → request the CDN link then serve as WebVTT (CORS-open).
router.get('/vtt', async (req, res) => {
  const id = String(req.query.id || '')
  if (!id || !OS_KEY) { res.status(400).json({ error: 'file id required' }); return }

  const cached = vttCache.get(id)
  const serve = (vtt: string) => {
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.send(vtt)
  }
  if (cached && Date.now() - cached.ts < VTT_TTL) { serve(cached.vtt); return }

  try {
    // 1) Ask OpenSubtitles for a temporary CDN download link (retry transient resets).
    const dr = await osFetch(`${OS_BASE}/download`, {
      method: 'POST', headers: osHeaders(true),
      body: JSON.stringify({ file_id: Number(id), sub_format: 'srt' }),
    })
    if (!dr || !dr.ok) { res.status(502).end(); return }
    const dj: any = await dr.json().catch(() => null)
    if (!dj?.link) { res.status(502).end(); return }

    // 2) Download the SRT from the CDN link (works from datacenters; retry transient resets).
    const sr = await osFetch(dj.link, { headers: { 'User-Agent': OS_UA }, redirect: 'follow' })
    if (!sr || !sr.ok) { res.status(502).end(); return }
    const vtt = srtToVtt(await sr.text())

    vttCache.set(id, { vtt, ts: Date.now() })
    if (vttCache.size > 800) { const oldest = [...vttCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0]; vttCache.delete(oldest[0]) }
    serve(vtt)
  } catch {
    res.status(502).end()
  }
})

// ── Anime subtitle proxy+convert ──────────────────────────────────────────────
// Anime providers (AniZone) return per-episode-matched subtitles as .ass (Advanced SubStation) or
// .srt — the browser <track> element only renders WebVTT. This route fetches the external sub and
// converts it, so anime that OpenSubtitles doesn't cover still gets accurate, in-sync subtitles.
function assToVtt(raw: string): string {
  const lines = raw.replace(/\r/g, '').split('\n')
  const pad = (t: string) => {
    // ASS time "H:MM:SS.cc" (centiseconds) → VTT "HH:MM:SS.mmm"
    const m = t.trim().match(/(\d+):(\d{2}):(\d{2})[.,](\d{2,3})/)
    if (!m) return '00:00:00.000'
    const ms = m[4].length === 2 ? m[4] + '0' : m[4].slice(0, 3)
    return `${m[1].padStart(2, '0')}:${m[2]}:${m[3]}.${ms}`
  }
  const cues: string[] = []
  for (const line of lines) {
    if (!line.startsWith('Dialogue:')) continue
    const parts = line.slice(9).split(',')
    if (parts.length < 10) continue
    const start = pad(parts[1]), end = pad(parts[2])
    const text = parts.slice(9).join(',')
      .replace(/\{[^}]*\}/g, '')       // strip ASS override tags {\i1} etc
      .replace(/\\N|\\n/g, '\n')       // ASS line breaks
      .replace(/\\h/g, ' ').trim()
    if (text) cues.push(`${start} --> ${end}\n${text}`)
  }
  return 'WEBVTT\n\n' + cues.join('\n\n') + '\n'
}
const animeSubCache = new Map<string, { vtt: string; ts: number }>()
router.get('/anime', async (req, res) => {
  const u = String(req.query.u || '')
  let url = ''
  try { url = Buffer.from(u, 'base64url').toString('utf8') } catch { /* */ }
  if (!/^https:\/\//i.test(url)) { res.status(400).end(); return }
  const serve = (vtt: string) => {
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.send(vtt)
  }
  const hit = animeSubCache.get(url)
  if (hit && Date.now() - hit.ts < VTT_TTL) { serve(hit.vtt); return }
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12_000) })
    if (!r.ok) { res.status(502).end(); return }
    const raw = await r.text()
    const vtt = /\bDialogue:/.test(raw) ? assToVtt(raw)          // .ass
              : /^\s*WEBVTT/.test(raw) ? raw                     // already vtt
              : srtToVtt(raw)                                    // .srt
    animeSubCache.set(url, { vtt, ts: Date.now() })
    if (animeSubCache.size > 800) { const o = [...animeSubCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0]; animeSubCache.delete(o[0]) }
    serve(vtt)
  } catch { res.status(502).end() }
})

export { router as subtitlesRouter }
