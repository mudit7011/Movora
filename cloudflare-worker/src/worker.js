// Movora MovieBox proxy — Cloudflare Worker.
// Proxies MovieBox's DASH streams (sacdn/bcdn.hakunaymatata.com) so the browser's dash.js can play
// them: (1) adds CORS (the CDN sends none → browser blocks direct fetch), (2) attaches the
// CloudFront signed-URL params. Runs at the edge → heavy video bytes never hit our Render server.
//
// Routes:
//   /mpd?u=<b64url(mpd url)>&s=<b64url(signed query string)>
//        → fetch the .mpd, inject a <BaseURL> that points segments back at /seg/, return with CORS.
//   /seg/<b64url(dir)>/<b64url(signed qs)>/<segment name>
//        → fetch <dir><segment>?<signed qs>, stream back with CORS + Range support.

const ALLOWED = /(^|\.)hakunaymatata\.com$/i
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const b64urlEncode = (s) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const b64urlDecode = (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))

function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*',
    ...extra,
  }
}

function hostOk(u) {
  try { return ALLOWED.test(new URL(u).hostname) } catch { return false }
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() })

    const url = new URL(request.url)
    const path = url.pathname

    // ── Manifest ──────────────────────────────────────────────────────────
    if (path === '/mpd') {
      const mpdUrl = b64urlDecode(url.searchParams.get('u') || '')
      const sig = url.searchParams.get('s') || ''
      if (!hostOk(mpdUrl)) return new Response('bad url', { status: 400 })
      const signedQs = sig ? b64urlDecode(sig) : ''
      const upstream = await fetch(mpdUrl + (signedQs ? `?${signedQs}` : ''), { headers: { 'User-Agent': UA } })
      if (!upstream.ok) return new Response('upstream ' + upstream.status, { status: 502, headers: corsHeaders() })
      let mpd = await upstream.text()
      // Segments in this mpd are relative (SegmentTemplate, no BaseURL) → resolve them against the
      // mpd's directory. Inject a <BaseURL> pointing at /seg/ so dash.js fetches segments via us.
      const dir = mpdUrl.slice(0, mpdUrl.lastIndexOf('/') + 1)
      const base = `${url.origin}/seg/${b64urlEncode(dir)}/${sig}/`
      mpd = mpd.replace(/(<MPD\b[^>]*>)/, `$1<BaseURL>${base}</BaseURL>`)
      return new Response(mpd, { status: 200, headers: corsHeaders({ 'Content-Type': 'application/dash+xml', 'Cache-Control': 'no-store' }) })
    }

    // ── Segments / init ───────────────────────────────────────────────────
    if (path.startsWith('/seg/')) {
      const parts = path.slice(5).split('/')
      const dir = b64urlDecode(parts.shift() || '')
      const signedQs = b64urlDecode(parts.shift() || '')
      const seg = parts.join('/')
      const target = dir + seg + (signedQs ? `?${signedQs}` : '')
      if (!hostOk(target)) return new Response('bad seg', { status: 400 })
      const range = request.headers.get('Range')
      const upstream = await fetch(target, { headers: { 'User-Agent': UA, ...(range ? { Range: range } : {}) } })
      const h = new Headers(upstream.headers)
      for (const [k, v] of Object.entries(corsHeaders())) h.set(k, v)
      h.set('Cache-Control', 'public, max-age=86400')
      return new Response(upstream.body, { status: upstream.status, headers: h })
    }

    return new Response('movora-mb-proxy', { status: 200, headers: corsHeaders() })
  },
}
