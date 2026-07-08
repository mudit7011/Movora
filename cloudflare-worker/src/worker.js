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
// MovieBox's signed API. Render's datacenter IP is blocked by it, so the backend signs the request
// in Node and forwards it here — Cloudflare's edge IP isn't blocked, so the call goes through.
const API_ALLOWED = /(^|\.)aoneroom\.com$|(^|\.)inmoviebox\.com$/i
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
function apiHostOk(u) {
  try { return API_ALLOWED.test(new URL(u).hostname) } catch { return false }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() })

    const url = new URL(request.url)
    const path = url.pathname

    // ── Signed API forward ─────────────────────────────────────────────────
    // The backend POSTs { url, method, headers, body } already signed. We just re-issue it from the
    // edge (so aoneroom sees a Cloudflare IP, not the blocked Render IP) and hand back the response
    // plus the x-user header (which carries MovieBox's guest bearer token).
    if (path === '/api') {
      if (request.method !== 'POST') return new Response('method', { status: 405, headers: corsHeaders() })
      if (env && env.MB_PROXY_SECRET && request.headers.get('x-mb-auth') !== env.MB_PROXY_SECRET) {
        return new Response('forbidden', { status: 403, headers: corsHeaders() })
      }
      let p
      try { p = await request.json() } catch { return new Response('bad json', { status: 400, headers: corsHeaders() }) }
      const target = p && p.url
      if (!apiHostOk(target)) return new Response('bad host', { status: 400, headers: corsHeaders() })
      const upstream = await fetch(target, {
        method: p.method || 'GET',
        headers: p.headers || {},
        body: p.body != null ? p.body : undefined,
      })
      const buf = await upstream.arrayBuffer()
      const h = corsHeaders({
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
        'x-mb-status': String(upstream.status),
      })
      const xu = upstream.headers.get('x-user')
      if (xu) h['x-mb-user'] = xu
      return new Response(buf, { status: upstream.status, headers: h })
    }

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
