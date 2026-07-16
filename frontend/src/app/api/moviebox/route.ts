import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// ─── MovieBox (aoneroom) extraction — pinned to Mumbai (bom1) ────────────────────────────────────
// MovieBox's API is GEO-fenced: it rejects our Render (US) datacenter IP with 403 "Service not
// available in current region". This route runs the 3 signing calls from Vercel's Mumbai (bom1)
// region — an India IP — which passes the region check. The backend delegates extraction here; the
// video itself still streams through the Cloudflare Worker (that CDN isn't region-blocked).
export const runtime = 'nodejs'
export const preferredRegion = ['bom1']
export const dynamic = 'force-dynamic'

const HOSTS = ['https://api6.aoneroom.com', 'https://api5.aoneroom.com', 'https://api4.aoneroom.com', 'https://api.inmoviebox.com']
const SECRET_KEY = '76iRl07s0xSN9jqmEWAt79EBJZulIQIsV64FZr2O'
const VC = 50020042
const UA = `com.community.oneroom/${VC} (Linux; U; Android 13; en_US; 23078RKD5C; Build/TQ2A.230405.003; Cronet/135.0.7012.3)`
const MB_PROXY_URL = (process.env.MB_PROXY_URL || '').replace(/\/$/, '')

const md5 = (s: crypto.BinaryLike) => crypto.createHash('md5').update(s).digest('hex')
const b64url = (s: string) => Buffer.from(s, 'utf8').toString('base64url')

function clientInfo(): string {
  const deviceId = [...Array(32)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')
  return `{"package_name":"com.community.oneroom","version_name":"3.0.03.0529.03","version_code":${VC},"os":"android","os_version":"13","install_ch":"ps","device_id":"${deviceId}","install_store":"ps","gaid":"${crypto.randomUUID()}","brand":"Redmi","model":"23078RKD5C","system_language":"en","net":"NETWORK_WIFI","region":"IN","timezone":"Asia/Kolkata","sp_code":"40401","X-Play-Mode":"2"}`
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

async function getToken(): Promise<string | null> {
  for (const host of HOSTS) {
    try {
      const url = `${host}/wefeed-mobile-bff/tab-operating?page=1&tabId=0&version=`
      const r = await fetch(url, { headers: signedHeaders('GET', url, null, null), signal: AbortSignal.timeout(8_000) })
      const xu = r.headers.get('x-user')
      if (!xu) continue
      let token = ''
      try { token = JSON.parse(decodeURIComponent(xu)).token } catch { try { token = JSON.parse(xu).token } catch { /* */ } }
      if (token) return token
    } catch { /* try next host */ }
  }
  return null
}

const norm = (s: string) => (s || '').toLowerCase().replace(/\[[^\]]*\]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

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
      // Progressive match, safest first: exact → ignore leading article → bidirectional full-string
      // (catches year/subtitle suffixes) → distinctive first word. More matches → more Zenith HD.
      const strip = (s: string) => s.replace(/^(the|a|an) /, '')
      const w = strip(want), first = want.split(' ')[0]
      const st = (x: any) => x.subjectType === wantType
      const pick =
        items.find(x => st(x) && norm(x.title) === want) ||
        items.find(x => st(x) && strip(norm(x.title)) === w) ||
        items.find(x => st(x) && w.length > 3 && (strip(norm(x.title)).includes(w) || w.includes(strip(norm(x.title))))) ||
        items.find(x => st(x) && first.length > 3 && norm(x.title).includes(first))
      if (pick?.subjectId) return String(pick.subjectId)
    } catch { /* try next host */ }
  }
  return null
}

// ── H5 (web) API → H.264 MP4 fallback ───────────────────────────────────────────────────────────
// MovieBox's H5/web API (h5-api.aoneroom.com) is UNSIGNED and serves H.264 MP4 (plays everywhere,
// unlike the mobile API's HEVC). We reuse the subjectId from the reliable mobile search and DERIVE
// the detailPath the play endpoint needs (its slug is cosmetic; only the suffix matters, and the
// suffix = reverse(base62(subjectId))). Free tops at 720p (1080p is VIP-locked — not touched).
const H5_API = 'https://h5-api.aoneroom.com/wefeed-h5api-bff'
const H5_PLAY = 'https://netfilm.world/wefeed-h5api-bff'
const H5_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
  'Referer': 'https://moviebox.ph/', 'Origin': 'https://moviebox.ph',
  'X-Client-Info': '{"timezone":"Asia/Dhaka"}', 'X-Request-Lang': 'en', 'Accept': 'application/json',
}
const B62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const H5_TOKEN_TTL = 25 * 60 * 1000
function detailPathSuffix(subjectId: string): string {
  const SIXTYTWO = BigInt(62), ZERO = BigInt(0)
  let n = BigInt(subjectId); let s = ''
  if (n === ZERO) return '0'
  while (n > ZERO) { s = B62[Number(n % SIXTYTWO)] + s; n = n / SIXTYTWO }
  return s.split('').reverse().join('')   // MovieBox reverses the base62 string
}
let h5TokenCache: { token: string; ts: number } | null = null
async function getH5Token(): Promise<string | null> {
  if (h5TokenCache && Date.now() - h5TokenCache.ts < H5_TOKEN_TTL) return h5TokenCache.token
  try {
    const r = await fetch(`${H5_API}/home?host=moviebox.ph`, { headers: H5_HEADERS, signal: AbortSignal.timeout(8_000) })
    const xu = r.headers.get('x-user')
    if (!xu) return null
    let token = ''
    try { token = JSON.parse(decodeURIComponent(xu)).token } catch { try { token = JSON.parse(xu).token } catch { /* */ } }
    if (token) { h5TokenCache = { token, ts: Date.now() }; return token }
  } catch { /* */ }
  return null
}
// Returns a MovieBox H.264 MP4 source (best free ≤720p) proxied through the worker (/mp4 adds the
// required moviebox.ph referer), or null. Same `server:'MovieBox'` so it groups under Zenith and the
// player's failover naturally uses it when the HEVC DASH can't decode.
export let lastH5Debug: any = null
async function getH5Mp4(subjectId: string, se: number, ep: number): Promise<any | null> {
  lastH5Debug = { proxy: !!MB_PROXY_URL }
  // The H5 play endpoint is GEO-BLOCKED to Asia — it 403s from Vercel/Render's US region (works from
  // an India IP). So it's OFF by default; set MB_H5=1 only where the extractor egresses from Asia
  // (e.g. an India proxy/VPS). Fully functional otherwise — token bootstrap + play + worker /mp4.
  if (process.env.MB_H5 !== '1') { lastH5Debug.gated = true; return null }
  if (!MB_PROXY_URL) return null
  const token = await getH5Token()
  lastH5Debug.token = !!token
  if (!token) return null
  const dp = detailPathSuffix(subjectId)
  try {
    // Call play on h5-api.aoneroom.com — the region-specific stream domain (netfilm.world) is
    // geo-blocked for US (Vercel iad1 → 403), but h5-api.aoneroom.com serves the same H.264 streams
    // and isn't geo-blocked.
    const ref = `https://netfilm.world/spa/videoPlayPage/movies/${dp}?id=${subjectId}&type=/movie/detail&detailSe=${se}&detailEp=${ep}&lang=en`
    const url = `${H5_API}/subject/play?subjectId=${subjectId}&se=${se}&ep=${ep}&detailPath=${dp}`
    const r = await fetch(url, { headers: { ...H5_HEADERS, 'Referer': ref, 'Origin': 'https://netfilm.world', 'X-Source': '', 'Authorization': `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) })
    lastH5Debug.playStatus = r.status
    if (!r.ok) return null
    const d: any = await r.json().catch(() => null)
    const all: any[] = d?.data?.streams || []
    lastH5Debug.hasResource = d?.data?.hasResource; lastH5Debug.vipLocked = d?.data?.vipLocked; lastH5Debug.totalStreams = all.length
    lastH5Debug.streams = all.map((s: any) => `${s.resolutions}/${s.codecName}/${s.url ? 'url' : 'empty'}`)
    const streams: any[] = all.filter((s: any) => s?.url && String(s?.codecName).toLowerCase() === 'h264')
    if (!streams.length) return null
    // Best playable free rendition (highest resolution that actually has a url — 1080p is VIP-empty).
    streams.sort((a, b) => (Number(b.resolutions) || 0) - (Number(a.resolutions) || 0))
    const best = streams[0]
    const proxied = `${MB_PROXY_URL}/mp4?u=${encodeURIComponent(b64url(best.url))}`
    return { server: 'MovieBox', lang: `${best.resolutions}p H.264`, url: proxied, type: 'mp4', referer: '' }
  } catch { return null }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const type = searchParams.get('type') === 'tv' ? 'tv' : 'movie'
  const title = searchParams.get('title') || ''
  const season = searchParams.get('season') || ''
  const episode = searchParams.get('episode') || ''
  const debug = searchParams.get('debug') === '1'

  if (!title) return NextResponse.json({ sources: [], region: process.env.VERCEL_REGION || null })

  const isTv = type === 'tv'
  try {
    const token = await getToken()
    if (!token) return NextResponse.json({ sources: [], step: 'token', region: process.env.VERCEL_REGION || null })
    const subjectId = await searchSubject(token, title, isTv)
    if (!subjectId) return NextResponse.json({ sources: [], step: 'search', region: process.env.VERCEL_REGION || null })
    const se = isTv ? Number(season) || 0 : 0
    const ep = isTv ? Number(episode) || 0 : 0
    // H.264 MP4 fallback from the H5 API — fetched concurrently with the HEVC DASH.
    const mp4Promise = getH5Mp4(subjectId, se, ep).catch(() => null)
    let dashSource: any = null
    let codec = ''
    for (const host of HOSTS) {
      try {
        const url = `${host}/wefeed-mobile-bff/subject-api/play-info?subjectId=${subjectId}&se=${se}&ep=${ep}`
        const r = await fetch(url, { headers: signedHeaders('GET', url, null, token), signal: AbortSignal.timeout(8_000) })
        if (!r.ok) continue
        const d: any = await r.json().catch(() => null)
        const stream = (d?.data?.streams || [])[0]
        if (!stream?.url || !stream?.signCookie) continue
        const kv: Record<string, string> = {}
        for (const p of String(stream.signCookie).split(';')) { const i = p.indexOf('='); if (i > 0) kv[p.slice(0, i).trim()] = p.slice(i + 1).trim() }
        const signedQs = `Policy=${encodeURIComponent(kv['CloudFront-Policy'] || '')}&Signature=${encodeURIComponent(kv['CloudFront-Signature'] || '')}&Key-Pair-Id=${encodeURIComponent(kv['CloudFront-Key-Pair-Id'] || '')}`
        const proxied = `${MB_PROXY_URL}/mpd?u=${encodeURIComponent(b64url(stream.url))}&s=${encodeURIComponent(b64url(signedQs))}`
        const best = String(stream.resolutions || '').split(',')[0].trim()
        codec = stream.codecName
        dashSource = { server: 'MovieBox', lang: best ? `${best}p` : 'HD', url: proxied, type: 'dash', referer: '' }
        break
      } catch { /* try next host */ }
    }
    const mp4Source = await mp4Promise
    // DASH (HEVC 1080p) first = default; MP4 (H.264 ≤720p) second = the fallback when HEVC won't decode.
    const sources = MB_PROXY_URL ? [dashSource, mp4Source].filter(Boolean) : []
    return NextResponse.json({
      sources,
      reached: 'play-info', hasProxy: !!MB_PROXY_URL,
      region: process.env.VERCEL_REGION || null,
      ...(debug ? { subjectId, codec, h264: !!mp4Source, h5: lastH5Debug } : {}),
    })
  } catch (e: any) {
    return NextResponse.json({ sources: [], error: String(e?.message || e), region: process.env.VERCEL_REGION || null })
  }
}
