import { NextRequest, NextResponse } from 'next/server'
import { tmdbFetch } from '@/lib/tmdbFetch'

const IMG_STILL = 'https://image.tmdb.org/t/p/w300'

// Cache episode data at Vercel's CDN edge.
// Season episode lists change at most a few times a year (new episodes air).
// s-maxage=3600: CDN serves the cached response for 1 hour without invoking this function.
// stale-while-revalidate=86400: CDN continues serving stale data for 24h while
//   refreshing in the background, so users never see a loading state from a cold edge.
const EPISODE_CACHE = 'public, s-maxage=3600, stale-while-revalidate=86400'

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

    return NextResponse.json(episodes, {
      headers: { 'Cache-Control': EPISODE_CACHE },
    })
  } catch {
    return NextResponse.json([])
  }
}
