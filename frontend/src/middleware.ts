import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Bots blocked on /watch/* routes.
// Lowercase strings matched against lowercased User-Agent.
// Googlebot / Bingbot are intentionally absent — we want them to index watch pages.
const BLOCKED_BOTS = [
  'amazonbot',
  'gptbot',
  'claudebot',
  'anthropic-ai',
  'bytespider',
  'ccbot',
  'omgili',
  'semrushbot',
  'ahrefsbot',
  'mj12bot',
  'dotbot',
  'petalbot',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Block direct /admin access — panel lives at /ctrl
  if (pathname.startsWith('/admin')) {
    return NextResponse.rewrite(new URL('/not-found', request.url))
  }

  // Bot check runs BEFORE the vercel.app noindex branch so that aggressive
  // crawlers get 403 regardless of which host they used. A noindex header
  // does not stop execution — it only affects indexing AFTER the response.
  if (pathname.startsWith('/watch/')) {
    const ua = (request.headers.get('user-agent') ?? '').toLowerCase()
    if (BLOCKED_BOTS.some(bot => ua.includes(bot))) {
      return new NextResponse(null, { status: 403 })
    }
  }

  // Vercel preview deployments: add noindex header and continue.
  // Crawlers that bypass robots.txt and hit *.vercel.app still see this.
  const host = request.headers.get('host') ?? ''
  if (host.endsWith('.vercel.app')) {
    const response = NextResponse.next()
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    return response
  }

  return NextResponse.next()
}

export const config = {
  // Narrow matcher: only the two paths this middleware actually acts on.
  // The vercel.app noindex header is handled in next.config.js via the
  // `headers` config so it costs zero invocations.
  matcher: ['/admin/:path*', '/watch/:path*'],
}
