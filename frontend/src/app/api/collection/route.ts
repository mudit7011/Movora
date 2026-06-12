import { NextRequest, NextResponse } from 'next/server'
import { tmdbFetch } from '@/lib/tmdbFetch'

const IMG_W = 'https://image.tmdb.org/t/p/w342'
const BACKEND = process.env.BACKEND_URL || 'http://localhost:3001'

export async function GET(req: NextRequest) {
  const rawId = req.nextUrl.searchParams.get('tmdbId')?.replace(/^(tv_|movie_)/, '')
  if (!rawId) return NextResponse.json([])

  try {
    const movie = await tmdbFetch(`/movie/${rawId}?language=en-US`)
    if (!movie.belongs_to_collection) return NextResponse.json([])

    const col = await tmdbFetch(`/collection/${movie.belongs_to_collection.id}?language=en-US`)

    const parts: { tmdbId: string; title: string; posterUrl: string; year: number; slug: string; partNumber: number; collectionName: string; unreleased: boolean }[] =
      ((col.parts ?? []) as any[])
        .filter((p: any) => p.release_date) // skip unreleased
        .sort((a: any, b: any) => a.release_date.localeCompare(b.release_date))
        .map((p: any, i: number) => {
          const year = parseInt(p.release_date.split('-')[0])
          return {
            tmdbId: String(p.id),
            title: p.title ?? '',
            posterUrl: p.poster_path ? `${IMG_W}${p.poster_path}` : '',
            year,
            slug: '',           // filled in below from DB
            partNumber: i + 1,
            collectionName: col.name ?? '',
            unreleased: false,
          }
        })

    if (parts.length === 0) return NextResponse.json([])

    // Ask backend which of these tmdbIds exist in our DB, get back id→slug map
    const idList = parts.map(p => p.tmdbId).join(',')
    const checkRes = await fetch(
      `${BACKEND}/api/movies/check-collection?ids=${encodeURIComponent(idList)}`,
      { next: { revalidate: 3600 } }
    )
    const slugMap: Record<string, string> = checkRes.ok ? await checkRes.json() : {}

    // Attach real DB slugs; drop parts not in our DB
    const available = parts
      .filter(p => slugMap[p.tmdbId])
      .map(p => ({ ...p, slug: slugMap[p.tmdbId] }))

    if (available.length === 0) return NextResponse.json([])

    const response = NextResponse.json(available)
    response.headers.set('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600')
    return response
  } catch {
    return NextResponse.json([])
  }
}
