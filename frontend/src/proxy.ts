import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const BLOCKED_BOTS = [
  'amazonbot', 'gptbot', 'claudebot', 'anthropic-ai', 'bytespider',
  'ccbot', 'omgili', 'semrushbot', 'ahrefsbot', 'mj12bot', 'dotbot', 'petalbot',
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Block direct /admin access — panel lives at /ctrl
  if (pathname.startsWith('/admin')) {
    return NextResponse.rewrite(new URL('/not-found', request.url))
  }

  // Block bots on dynamic pages to prevent on-demand ISR write spam
  if (pathname.startsWith('/watch/') || pathname.startsWith('/movie/') || pathname.startsWith('/show/')) {
    const ua = (request.headers.get('user-agent') ?? '').toLowerCase()
    if (BLOCKED_BOTS.some(bot => ua.includes(bot))) {
      return new NextResponse(null, { status: 403 })
    }
    if (pathname.startsWith('/watch/')) {
      const res = NextResponse.next()
      res.headers.set('x-middleware-cache', 'no-personalization')
      return res
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/watch/:path*', '/movie/:path*', '/show/:path*'],
}
