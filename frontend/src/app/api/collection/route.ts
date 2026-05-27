import { NextRequest, NextResponse } from 'next/server'
import { tmdbFetch } from '@/lib/tmdbFetch'

const IMG_W = 'https://image.tmdb.org/t/p/w342'
const BACKEND = process.env.BACKEND_URL ?? ''

function slugify(title: string, year: number) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + year
}

export async function GET(req: NextRequest) {
  const rawId = req.nextUrl.searchParams.get('tmdbId')?.replace(/^(tv_|movie_)/, '')
  if (!rawId) return NextResponse.json([])

  try {
    const movie = await tmdbFetch(`/movie/${rawId}?language=en-US`)
    if (!movie.belongs_to_collection) return NextResponse.json([])

    const col = await tmdbFetch(`/collection/${movie.belongs_to_collection.id}?language=en-US`)

    const parts = ((col.parts ?? []) as any[])
      .sort((a, b) => {
        const da = a.release_date || '9999-99-99'
        const db = b.release_date || '9999-99-99'
        return da.localeCompare(db)
      })
      .map((p, i) => {
        const year = p.release_date ? parseInt(p.release_date.split('-')[0]) : 0
        return {
          tmdbId: String(p.id),
          title: p.title ?? '',
          posterUrl: p.poster_path ? `${IMG_W}${p.poster_path}` : '',
          year,
          slug: slugify(p.title ?? '', year),
          partNumber: i + 1,
          collectionName: col.name ?? '',
          unreleased: !p.release_date,
        }
      })

    if (parts.length === 0) return NextResponse.json([])

    // Filter to only parts that actually exist in our database
    const slugList = parts.map(p => p.slug).join(',')
    const existingRes = await fetch(`${BACKEND}/movies/check-slugs?slugs=${encodeURIComponent(slugList)}`)
    const existingSlugs: string[] = existingRes.ok ? await existingRes.json() : []
    const existingSet = new Set(existingSlugs)

    const available = parts.filter(p => existingSet.has(p.slug))

    if (available.length === 0) return NextResponse.json([])

    return NextResponse.json(available)
  } catch {
    return NextResponse.json([])
  }
}
