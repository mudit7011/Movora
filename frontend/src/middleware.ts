import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const BLOCKED_BOTS = [
  'amazonbot', 'gptbot', 'claudebot', 'anthropic-ai', 'bytespider',
  'ccbot', 'omgili', 'semrushbot', 'ahrefsbot', 'mj12bot', 'dotbot', 'petalbot',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Block direct /admin access — panel lives at /ctrl
  if (pathname.startsWith('/admin')) {
    return NextResponse.rewrite(new URL('/not-found', request.url))
  }

  // Bot check on /watch/* — return early with 403, no response object created for real users
  if (pathname.startsWith('/watch/')) {
    const ua = (request.headers.get('user-agent') ?? '').toLowerCase()
    if (BLOCKED_BOTS.some(bot => ua.includes(bot))) {
      return new NextResponse(null, { status: 403 })
    }
    // Real user — pass through with cache hint so Vercel CDN can cache the SSR response
    const res = NextResponse.next()
    res.headers.set('x-middleware-cache', 'no-personalization')
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/watch/:path*'],
}
