// ─── MovieBox (aoneroom) extractor ─────────────────────────────────────────────
// MovieBox = nxsha's "MbPly" server. It has HD (1080p) DASH streams for titles where FebBox only
// transcoded 360p (new seasons, HEVC content). Its API is signed (MD5/HMAC-MD5 with hardcoded keys)
// — fully doable over plain HTTP (Render-friendly). Streams are HEVC DASH on hakunaymatata behind
// CloudFront + no CORS, so they're played via our Cloudflare Worker proxy (MB_PROXY_URL) which adds
// CORS + the signed-URL auth. Reference: github.com/Simatwa/moviebox-api.
import crypto from 'crypto'

const HOSTS = ['https://api6.aoneroom.com', 'https://api5.aoneroom.com', 'https://api4.aoneroom.com', 'https://api.inmoviebox.com']
const SECRET_KEY = '76iRl07s0xSN9jqmEWAt79EBJZulIQIsV64FZr2O'
const VC = 50020042
const UA = `com.community.oneroom/${VC} (Linux; U; Android 13; en_US; 23078RKD5C; Build/TQ2A.230405.003; Cronet/135.0.7012.3)`
// The Cloudflare Worker that proxies the DASH streams (adds CORS + CloudFront auth). Without it we
// can't play the streams in-browser, so MovieBox is skipped when unset.
const MB_PROXY_URL = (process.env.MB_PROXY_URL || '').replace(/\/$/, '')

const md5 = (s: crypto.BinaryLike) => crypto.createHash('md5').update(s).digest('hex')
const b64url = (s: string) => Buffer.from(s, 'utf8').toString('base64url')

function clientInfo(): string {
  const deviceId = [...Array(32)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')
  return `{"package_name":"com.community.oneroom","version_name":"3.0.03.0529.03","version_code":${VC},"os":"android","os_version":"13","install_ch":"ps","device_id":"${deviceId}","install_store":"ps","gaid":"${crypto.randomUUID()}","brand":"Redmi","model":"23078RKD5C","system_language":"en","net":"NETWORK_WIFI","region":"US","timezone":"Asia/Kolkata","sp_code":"40401","X-Play-Mode":"2"}`
}
const CLIENT_INFO = clientInfo()

const xClientToken = (ts: number) => `${ts},${md5(String(ts).split('').reverse().join(''))}`

function sortedQuery(url: string): string {
  const u = new URL(url)
  const keys = [...new Set([...u.searchParams.keys()])].sort()
  const parts: string[] = []
  for (const k of keys) for (const v of u.searchParams.getAll(k)) parts.push(`${k}=${v}`)
  return parts.join('&')
}

function xTrSignature(method: string, url: string, body: string | null, ts: number): string {
  const u = new URL(url)
  const q = sortedQuery(url)
  const canonUrl = q ? `${u.pathname}?${q}` : u.pathname
  const bodyHash = body ? md5(Buffer.from(body, 'utf8')) : ''
  const bodyLen = body ? String(Buffer.byteLength(body, 'utf8')) : ''
  const canon = `${method.toUpperCase()}\napplication/json\napplication/json\n${bodyLen}\n${ts}\n${bodyHash}\n${canonUrl}`
  const mac = crypto.createHmac('md5', Buffer.from(SECRET_KEY, 'base64')).update(canon, 'utf8').digest('base64')
  return `${ts}|2|${mac}`
}

function signedHeaders(method: string, url: string, body: string | null, token: string | null): Record<string, string> {
  const ts = Date.now()
  const h: Record<string, string> = {
    'User-Agent': UA, 'Accept': 'application/json', 'Content-Type': 'application/json',
    'X-Client-Token': xClientToken(ts), 'x-tr-signature': xTrSignature(method, url, body, ts),
    'X-Client-Info': CLIENT_INFO, 'X-Client-Status': '0',
  }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

// ── Guest bearer token (from the x-user response header on a bootstrap call). Cached ~25 min. ──
let tokenCache: { token: string; ts: number } | null = null
const TOKEN_TTL = 25 * 60 * 1000
async function getToken(): Promise<string | null> {
  if (tokenCache && Date.now() - tokenCache.ts < TOKEN_TTL) return tokenCache.token
  for (const host of HOSTS) {
    try {
      const url = `${host}/wefeed-mobile-bff/tab-operating?page=1&tabId=0&version=`
      const r = await fetch(url, { headers: signedHeaders('GET', url, null, null), signal: AbortSignal.timeout(8_000) })
      const xu = r.headers.get('x-user')
      if (!xu) continue
      let token = ''
      try { token = JSON.parse(decodeURIComponent(xu)).token } catch { try { token = JSON.parse(xu).token } catch { /* */ } }
      if (token) { tokenCache = { token, ts: Date.now() }; return token }
    } catch { /* try next host */ }
  }
  return null
}

const norm = (s: string) => (s || '').toLowerCase().replace(/\[[^\]]*\]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

// Search MovieBox and pick the subject matching the expected TMDB title + type (movie=1, tv=2).
async function searchSubject(token: string, title: string, isTv: boolean): Promise<string | null> {
  const want = norm(title)
  for (const host of HOSTS) {
    try {
      const url = `${host}/wefeed-mobile-bff/subject-api/search`
      const body = JSON.stringify({ keyword: title, page: 1, perPage: 12 })
      const r = await fetch(url, { method: 'POST', headers: signedHeaders('POST', url, body, token), body, signal: AbortSignal.timeout(8_000) })
      if (!r.ok) continue
      const d: any = await r.json().catch(() => null)
      const items: any[] = d?.data?.items || d?.data?.results || d?.data?.subjects || []
      const wantType = isTv ? 2 : 1
      // Prefer exact normalized-title match of the right type; else first same-type; else first.
      const exact = items.find(x => x.subjectType === wantType && norm(x.title) === want)
      const same = items.find(x => x.subjectType === wantType && norm(x.title).includes(want.split(' ')[0]))
      const pick = exact || same
      if (pick?.subjectId) return String(pick.subjectId)
    } catch { /* try next host */ }
  }
  return null
}

export interface MbSource { server: string; lang: string; url: string; type: 'dash'; referer: string }

// Returns a MovieBox HD (DASH) source routed through our CF worker, or [] if unavailable.
export async function getMovieBoxSources(type: string, season: string, episode: string, title: string): Promise<MbSource[]> {
  if (!MB_PROXY_URL || !title) return []
  const isTv = type === 'tv'
  try {
    const token = await getToken()
    if (!token) return []
    const subjectId = await searchSubject(token, title, isTv)
    if (!subjectId) return []
    const se = isTv ? Number(season) || 0 : 0
    const ep = isTv ? Number(episode) || 0 : 0
    for (const host of HOSTS) {
      try {
        const url = `${host}/wefeed-mobile-bff/subject-api/play-info?subjectId=${subjectId}&se=${se}&ep=${ep}`
        const r = await fetch(url, { headers: signedHeaders('GET', url, null, token), signal: AbortSignal.timeout(8_000) })
        if (!r.ok) continue
        const d: any = await r.json().catch(() => null)
        const stream = (d?.data?.streams || [])[0]
        if (!stream?.url || !stream?.signCookie) continue
        // Parse CloudFront cookie → signed-URL query string.
        const kv: Record<string, string> = {}
        for (const p of String(stream.signCookie).split(';')) { const i = p.indexOf('='); if (i > 0) kv[p.slice(0, i).trim()] = p.slice(i + 1).trim() }
        const signedQs = `Policy=${encodeURIComponent(kv['CloudFront-Policy'] || '')}&Signature=${encodeURIComponent(kv['CloudFront-Signature'] || '')}&Key-Pair-Id=${encodeURIComponent(kv['CloudFront-Key-Pair-Id'] || '')}`
        const proxied = `${MB_PROXY_URL}/mpd?u=${encodeURIComponent(b64url(stream.url))}&s=${encodeURIComponent(b64url(signedQs))}`
        const best = String(stream.resolutions || '').split(',')[0].trim()   // e.g. "1080"
        const qual = best ? `${best}p` : 'HD'
        return [{ server: 'MovieBox', lang: qual, url: proxied, type: 'dash', referer: '' }]
      } catch { /* try next host */ }
    }
    return []
  } catch { return [] }
}
