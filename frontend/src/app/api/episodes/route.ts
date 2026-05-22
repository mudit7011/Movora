import { NextRequest, NextResponse } from 'next/server'
import { tmdbFetch } from '@/lib/tmdbFetch'

const IMG_STILL = 'https://image.tmdb.org/t/p/w300'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const tmdbId = searchParams.get('tmdbId')?.replace(/^tv_/, '')
  const season = parseInt(searchParams.get('season') ?? '1')

  if (!tmdbId || isNaN(season)) {
    return NextResponse.json({ error: 'Missing tmdbId or season' }, { status: 400 })
  }

  try {
    const data = await tmdbFetch(`/tv/${tmdbId}/season/${season}?language=en-US`)
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
    return NextResponse.json([])
  }
}
