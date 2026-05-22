import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

async function proxy(req: NextRequest, context: { params: { path: string[] } }) {
  const { path } = context.params
  const url = `${BACKEND}/api/admin/${path.join('/')}`

  const forwardHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const auth = req.headers.get('Authorization')
  if (auth) forwardHeaders['Authorization'] = auth

  let body: string | undefined
  const method = req.method
  if (method !== 'GET' && method !== 'HEAD') {
    body = await req.text()
  }

  const res = await fetch(url, {
    method,
    headers: forwardHeaders,
    body,
    signal: AbortSignal.timeout(30000),
  })

  const data = await res.text()
  return new NextResponse(data, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const DELETE = proxy
export const PATCH = proxy
