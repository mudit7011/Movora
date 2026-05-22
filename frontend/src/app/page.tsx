export const dynamic = 'force-dynamic'

import { api } from '@/lib/api'
import HomePageClient from '@/components/HomePageClient'

export default async function HomePage() {
  const [trending, latest, hindi, english, trendingShows, latestShows, hindiShows, englishShows] = await Promise.all([
    api.getTrending().catch(() => []),
    api.getLatest().catch(() => []),
    api.getByLanguage('Hindi').catch(() => []),
    api.getByLanguage('English').catch(() => []),
    api.getTrendingShows().catch(() => []),
    api.getLatestShows().catch(() => []),
    api.getShowsByLanguage('Hindi').catch(() => []),
    api.getShowsByLanguage('English').catch(() => []),
  ])

  return (
    <HomePageClient
      trending={trending}
      latest={latest}
      hindi={hindi}
      english={english}
      trendingShows={trendingShows}
      latestShows={latestShows}
      hindiShows={hindiShows}
      englishShows={englishShows}
    />
  )
}
