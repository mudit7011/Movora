export const revalidate = 300

import { api } from '@/lib/api'
import HomePageClient from '@/components/HomePageClient'

export default async function HomePage() {
  const [
    trending, nowPlaying, popularMovies, topRatedMovies,
    hindiMovies, koreanMovies, japaneseMovies,
    trendingShows, popularShows, topRatedShows,
    hindiShows, koreanShows, japaneseShows,
  ] = await Promise.all([
    api.getTrending().catch(() => []),
    api.getNowPlaying().catch(() => []),
    api.getPopularMovies().catch(() => []),
    api.getTopRatedMovies().catch(() => []),
    api.getHindiMovies().catch(() => []),
    api.getKoreanMovies().catch(() => []),
    api.getJapaneseMovies().catch(() => []),
    api.getTrendingShows().catch(() => []),
    api.getPopularShows().catch(() => []),
    api.getTopRatedShows().catch(() => []),
    api.getHindiShows().catch(() => []),
    api.getKoreanShows().catch(() => []),
    api.getJapaneseShows().catch(() => []),
  ])

  return (
    <HomePageClient
      trending={trending}
      nowPlaying={nowPlaying}
      popularMovies={popularMovies}
      topRatedMovies={topRatedMovies}
      hindiMovies={hindiMovies}
      koreanMovies={koreanMovies}
      japaneseMovies={japaneseMovies}
      trendingShows={trendingShows}
      popularShows={popularShows}
      topRatedShows={topRatedShows}
      hindiShows={hindiShows}
      koreanShows={koreanShows}
      japaneseShows={japaneseShows}
    />
  )
}
