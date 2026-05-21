import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Block direct /admin access — panel lives at /ctrl
  if (request.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.rewrite(new URL('/not-found', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
