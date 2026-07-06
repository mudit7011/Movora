import { Router } from 'express'

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
      mapped = ((d?.data) || []).map((item: any) => {
        const a = item.attributes || {}
        const file = (a.files || [])[0] || {}
        const lang = String(a.language || '').toLowerCase()
        return {
          id: String(file.file_id || ''), lang, display: displayName(lang), flag: flagUrl(lang),
          release: a.release || file.file_name || '', downloads: Number(a.download_count || 0),
          hi: !!a.hearing_impaired, origin: originOf(a.release || ''),
        }
      }).filter((s: SubOut) => s.id)
      searchCache.set(cacheKey, { data: mapped!, ts: Date.now() })
      if (searchCache.size > 500) { const o = [...searchCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0]; searchCache.delete(o[0]) }
    } else {
      mapped = hit ? hit.data : []   // serve stale on transient API failure
    }
  }

  let subtitles: SubOut[] = mapped ?? []   // API orders by download_count desc
  if (!all) {
    const seen = new Set<string>()
    subtitles = subtitles.filter(s => { if (seen.has(s.display)) return false; seen.add(s.display); return true })
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

export { router as subtitlesRouter }
