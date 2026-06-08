import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const videoId = searchParams.get('video_id')
  const tmdb = searchParams.get('tmdb')
  const s = searchParams.get('s')
  const e = searchParams.get('e')

  if (!videoId) return new NextResponse('Missing video_id', { status: 400 })

  let upstream = `https://multiembed.mov/?video_id=${videoId}`
  if (tmdb) upstream += `&tmdb=${tmdb}`
  if (s) upstream += `&s=${s}`
  if (e) upstream += `&e=${e}`

  try {
    const res = await fetch(upstream, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://watchmovora.com/',
      },
      redirect: 'follow',
    })

    // If multiembed redirected us to the actual player (streamingnow.mov etc.)
    if (res.url && res.url !== upstream) {
      return NextResponse.redirect(res.url)
    }

    // Otherwise proxy the HTML so it renders inside our iframe
    const html = await res.text()
    return new NextResponse(html, {
      status: res.status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'SAMEORIGIN',
      },
    })
  } catch {
    return new NextResponse('Player unavailable', { status: 502 })
  }
}
