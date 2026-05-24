import { NextRequest, NextResponse } from 'next/server'
import { tmdbFetch } from '@/lib/tmdbFetch'

const IMG_W = 'https://image.tmdb.org/t/p/w342'

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
        // Push unreleased (no date) to end
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

    return NextResponse.json(parts)
  } catch {
    return NextResponse.json([])
  }
}
