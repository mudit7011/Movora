export const dynamic = 'force-dynamic'

import { api } from '@/lib/api'
import HomePageClient from '@/components/HomePageClient'

export default async function HomePage() {
  const [
    trending, latest, popularMovies, topRatedMovies, hindi, english,
    trendingShows, latestShows, popularShows, topRatedShows,
    hindiShows, koreanShows, japaneseShows,
  ] = await Promise.all([
    api.getTrending().catch(() => []),
    api.getLatest().catch(() => []),
    api.getPopularMovies().catch(() => []),
    api.getTopRatedMovies().catch(() => []),
    api.getByLanguage('Hindi').catch(() => []),
    api.getByLanguage('English').catch(() => []),
    api.getTrendingShows().catch(() => []),
    api.getLatestShows().catch(() => []),
    api.getPopularShows().catch(() => []),
    api.getTopRatedShows().catch(() => []),
    api.getShowsByLanguage('Hindi').catch(() => []),
    api.getShowsByLanguage('Korean').catch(() => []),
    api.getShowsByLanguage('Japanese').catch(() => []),
  ])

  return (
    <HomePageClient
      trending={trending}
      latest={latest}
      popularMovies={popularMovies}
      topRatedMovies={topRatedMovies}
      hindi={hindi}
      english={english}
      trendingShows={trendingShows}
      latestShows={latestShows}
      popularShows={popularShows}
      topRatedShows={topRatedShows}
      hindiShows={hindiShows}
      koreanShows={koreanShows}
      japaneseShows={japaneseShows}
    />
  )
}
