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
      const exact = items.find(x => x.subjectType === wantType && norm(x.title) === want)
      const same = items.find(x => x.subjectType === wantType && norm(x.title).includes(want.split(' ')[0]))
      const pick = exact || same
      if (pick?.subjectId) return String(pick.subjectId)
    } catch { /* try next host */ }
  }
  return null
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
        const qual = best ? `${best}p` : 'HD'
        // If MB_PROXY_URL isn't set (region-probe deploys), still confirm extraction reached play-info.
        return NextResponse.json({
          sources: MB_PROXY_URL ? [{ server: 'MovieBox', lang: qual, url: proxied, type: 'dash', referer: '' }] : [],
          reached: 'play-info', hasProxy: !!MB_PROXY_URL,
          region: process.env.VERCEL_REGION || null,
          ...(debug ? { subjectId, codec: stream.codecName } : {}),
        })
      } catch { /* try next host */ }
    }
    return NextResponse.json({ sources: [], step: 'play-info', region: process.env.VERCEL_REGION || null })
  } catch (e: any) {
    return NextResponse.json({ sources: [], error: String(e?.message || e), region: process.env.VERCEL_REGION || null })
  }
}
