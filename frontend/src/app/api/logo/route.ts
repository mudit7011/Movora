import { NextRequest, NextResponse } from 'next/server'
import { tmdbFetch } from '@/lib/tmdbFetch'

const IMG_LOGO = 'https://image.tmdb.org/t/p/w500'

// Title-treatment logos rarely change — cache hard at the edge.
const LOGO_CACHE = 'public, s-maxage=86400, stale-while-revalidate=604800'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const tmdbId = searchParams.get('tmdbId')?.replace(/^(tv|movie)_/, '')
  const type = searchParams.get('type') === 'tv' ? 'tv' : 'movie'
  if (!tmdbId) return NextResponse.json({ logo: null })

  try {
    const data = await tmdbFetch(`/${type}/${tmdbId}/images?include_image_language=en,null`)
    const logos = (data.logos ?? []) as { file_path: string; iso_639_1: string | null }[]
    // Prefer English, then language-neutral; within that prefer PNG (transparent) over SVG.
    const langRank = (l: { iso_639_1: string | null }) => (l.iso_639_1 === 'en' ? 0 : !l.iso_639_1 ? 1 : 2)
    const pngRank = (l: { file_path: string }) => (/\.png$/i.test(l.file_path) ? 0 : 1)
    const pick = [...logos].sort((a, b) => langRank(a) - langRank(b) || pngRank(a) - pngRank(b))[0]

    return NextResponse.json(
      { logo: pick ? `${IMG_LOGO}${pick.file_path}` : null },
      { headers: { 'Cache-Control': LOGO_CACHE } },
    )
  } catch {
    return NextResponse.json({ logo: null })
  }
}
