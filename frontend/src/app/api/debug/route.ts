import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'NOT SET'
  let status = 'untested'
  try {
    const res = await fetch(`${backendUrl}/api/movies/trending`, { signal: AbortSignal.timeout(5000) })
    status = `${res.status} ${res.ok ? 'OK' : 'ERROR'}`
  } catch (e: unknown) {
    status = `FETCH_ERROR: ${e instanceof Error ? e.message : String(e)}`
  }
  return NextResponse.json({ backendUrl, status })
}
