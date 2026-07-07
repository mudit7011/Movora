import { NextRequest, NextResponse } from 'next/server'

// Runs in Mumbai (bom1) so FebBox sees an *India* IP and hands back an India-region shegu CDN node
// — otherwise Render's Singapore/US egress gets a US node and Indian users buffer. This route only
// proxies the small FebBox *API* calls (id/share/file/quality_list JSON), never video bytes.
export const runtime = 'nodejs'
export const preferredRegion = 'bom1'
export const dynamic = 'force-dynamic'

const SECRET = process.env.FBPROXY_SECRET || ''
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  // Debug: report the egress IP + region so we can verify it's actually India before wiring it in.
  if (searchParams.get('debug') === '1') {
    let egressIp = 'unknown'
    try { egressIp = (await (await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(6000) })).json()).ip } catch {}
    return NextResponse.json({ egressIp, region: process.env.VERCEL_REGION || 'unknown' })
  }

  // Secured proxy — only our backend (with the shared secret) may use it.
  if (!SECRET || req.headers.get('x-fb-secret') !== SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const url = searchParams.get('url') || ''
  if (!/^https:\/\/(www\.)?febbox\.com\//.test(url) && !/^https:\/\/id-mapping-api-showbox-proxy\.hf\.space\//.test(url)) {
    return NextResponse.json({ error: 'bad url' }, { status: 400 })
  }
  const cookie = req.headers.get('x-fb-cookie') || ''
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'sec-ch-ua': '"Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'Sec-Fetch-Mode': 'cors',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.febbox.com/',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      signal: AbortSignal.timeout(9000),
    })
    const text = await r.text()
    return new NextResponse(text, { status: r.status, headers: { 'Content-Type': r.headers.get('content-type') || 'application/json' } })
  } catch (e: any) {
    return NextResponse.json({ error: 'fetch failed', detail: String(e?.message || e) }, { status: 502 })
  }
}
