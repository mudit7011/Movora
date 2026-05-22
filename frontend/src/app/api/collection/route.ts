import { NextRequest, NextResponse } from 'next/server'

const TMDB_BASE = 'https://api.themoviedb.org/3'
const IMG_W = 'https://image.tmdb.org/t/p/w342'

function slugify(title: string, year: number) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + year
}

export async function GET(req: NextRequest) {
  const rawId = req.nextUrl.searchParams.get('tmdbId')?.replace(/^(tv_|movie_)/, '')
  if (!rawId) return NextResponse.json([])

  const bearer = process.env.TMDB_BEARER
  if (!bearer) return NextResponse.json([])

  try {
    const movieRes = await fetch(`${TMDB_BASE}/movie/${rawId}?language=en-US`, {
      headers: { Authorization: `Bearer ${bearer}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!movieRes.ok) return NextResponse.json([])
    const movie = await movieRes.json()

    if (!movie.belongs_to_collection) return NextResponse.json([])

    const colRes = await fetch(`${TMDB_BASE}/collection/${movie.belongs_to_collection.id}?language=en-US`, {
      headers: { Authorization: `Bearer ${bearer}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!colRes.ok) return NextResponse.json([])
    const col = await colRes.json()

    const parts = ((col.parts ?? []) as any[])
      .sort((a, b) => (a.release_date ?? '').localeCompare(b.release_date ?? ''))
      .map((p, i) => ({
        tmdbId: String(p.id),
        title: p.title ?? '',
        posterUrl: p.poster_path ? `${IMG_W}${p.poster_path}` : '',
        year: p.release_date ? parseInt(p.release_date.split('-')[0]) : 0,
        slug: slugify(p.title ?? '', p.release_date ? parseInt(p.release_date.split('-')[0]) : 0),
        partNumber: i + 1,
        collectionName: col.name ?? '',
      }))

    return NextResponse.json(parts)
  } catch {
    return NextResponse.json([])
  }
}
