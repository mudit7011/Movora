import { NextRequest, NextResponse } from 'next/server'

const TMDB_BASE = 'https://api.themoviedb.org/3'
const IMG_STILL = 'https://image.tmdb.org/t/p/w300'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const tmdbId = searchParams.get('tmdbId')?.replace(/^tv_/, '')
  const season = parseInt(searchParams.get('season') ?? '1')

  if (!tmdbId || isNaN(season)) {
    return NextResponse.json({ error: 'Missing tmdbId or season' }, { status: 400 })
  }

  const bearer = process.env.TMDB_BEARER
  if (!bearer) {
    return NextResponse.json({ error: 'TMDB_BEARER not configured' }, { status: 500 })
  }

  try {
    const res = await fetch(
      `${TMDB_BASE}/tv/${tmdbId}/season/${season}?language=en-US`,
      {
        headers: {
          Authorization: `Bearer ${bearer}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      }
    )

    if (!res.ok) {
      return NextResponse.json([], { status: 200 })
    }

    const data = await res.json()
    const episodes = (data.episodes ?? []).map((ep: any) => ({
      episodeNumber: ep.episode_number,
      name: ep.name || `Episode ${ep.episode_number}`,
      overview: ep.overview || '',
      runtime: ep.runtime || 0,
      stillUrl: ep.still_path ? `${IMG_STILL}${ep.still_path}` : '',
      airDate: ep.air_date || '',
    }))

    return NextResponse.json(episodes)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
