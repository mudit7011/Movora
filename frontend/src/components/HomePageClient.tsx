'use client'

import { useCallback } from 'react'
import Hero from '@/components/Hero'
import Carousel from '@/components/Carousel'
import ContinueWatchingCarousel from '@/components/ContinueWatchingCarousel'
import Sidebar from '@/components/Sidebar'
import { useUserData } from '@/lib/useUserData'
import { useTV } from '@/components/TvProvider'
import type { Movie } from '@/types/movie'

interface Props {
  trending: Movie[]
  latest: Movie[]
  popularMovies: Movie[]
  topRatedMovies: Movie[]
  hindi: Movie[]
  english: Movie[]
  trendingShows: Movie[]
  latestShows: Movie[]
  popularShows: Movie[]
  topRatedShows: Movie[]
  hindiShows: Movie[]
  koreanShows: Movie[]
  japaneseShows: Movie[]
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="pt-6 pb-2 px-4 sm:px-6 lg:pl-24 lg:pr-8">
      <div className="flex items-center gap-3">
        <div className="w-1 h-5 bg-primary rounded-full" />
        <span className="text-xs font-semibold text-primary uppercase tracking-widest">{label}</span>
      </div>
    </div>
  )
}

export default function HomePageClient({
  trending, latest, popularMovies, topRatedMovies, hindi, english,
  trendingShows, latestShows, popularShows, topRatedShows,
  hindiShows, koreanShows, japaneseShows,
}: Props) {
  const isTV = useTV()
  const { continueWatching, addToWatchlist, removeFromHistory } = useUserData()

  const handleAddToWatchlist = useCallback((movie: Movie) => {
    addToWatchlist(movie)
  }, [addToWatchlist])

  // 8-slide hero: daily-rotating window through trending pool
  const daySeed = Math.floor(Date.now() / 86400000)
  const mOff = trending.length > 4 ? daySeed % (trending.length - 3) : 0
  const sOff = trendingShows.length > 4 ? (daySeed + 3) % (trendingShows.length - 3) : 0
  const topMovies = trending.slice(mOff, mOff + 4)
  const topShows  = trendingShows.slice(sOff, sOff + 4)
  const featuredItems: Movie[] = []
  for (let i = 0; i < 4; i++) {
    if (topMovies[i]) featuredItems.push(topMovies[i])
    if (topShows[i])  featuredItems.push(topShows[i])
  }
  const hero = featuredItems[0] ?? latest[0] ?? trending[0]

  return (
    <>
      <Sidebar />

      <main className={`min-h-screen pb-24 lg:pb-8 ${isTV ? 'pt-20' : ''}`}>
        {hero && <Hero movie={hero} movies={featuredItems} />}

        <div className="relative -mt-20 z-10">
          {continueWatching.length > 0 && (
            <ContinueWatchingCarousel
              items={continueWatching}
              onRemove={removeFromHistory}
            />
          )}

          {/* ── Movies ── */}
          <SectionDivider label="Movies" />

          {trending.length > 0 && (
            <Carousel
              title="Trending This Week"
              movies={trending}
              seeAllHref="/movies?sort=rating"
              onAddToWatchlist={handleAddToWatchlist}
            />
          )}

          {latest.length > 0 && (
            <Carousel
              title="Now Playing"
              movies={latest}
              seeAllHref="/movies?sort=recent"
              onAddToWatchlist={handleAddToWatchlist}
            />
          )}

          {popularMovies.length > 0 && (
            <Carousel
              title="Popular Movies"
              movies={popularMovies}
              seeAllHref="/movies?sort=rating"
              onAddToWatchlist={handleAddToWatchlist}
            />
          )}

          {topRatedMovies.length > 0 && (
            <Carousel
              title="Top Rated Movies"
              movies={topRatedMovies}
              seeAllHref="/movies?sort=rating"
              onAddToWatchlist={handleAddToWatchlist}
            />
          )}

          {hindi.length > 0 && (
            <Carousel
              title="Hindi Movies"
              movies={hindi}
              seeAllHref="/movies?language=Hindi"
              onAddToWatchlist={handleAddToWatchlist}
            />
          )}

          {english.length > 0 && (
            <Carousel
              title="English Movies"
              movies={english}
              seeAllHref="/movies?language=English"
              onAddToWatchlist={handleAddToWatchlist}
            />
          )}

          {/* ── TV Shows ── */}
          <SectionDivider label="TV Shows" />

          {trendingShows.length > 0 && (
            <Carousel
              title="Trending This Week"
              movies={trendingShows}
              seeAllHref="/shows?sort=rating"
              onAddToWatchlist={handleAddToWatchlist}
            />
          )}

          {latestShows.length > 0 && (
            <Carousel
              title="Airing Today"
              movies={latestShows}
              seeAllHref="/shows?sort=recent"
              onAddToWatchlist={handleAddToWatchlist}
            />
          )}

          {popularShows.length > 0 && (
            <Carousel
              title="Popular Shows"
              movies={popularShows}
              seeAllHref="/shows?sort=rating"
              onAddToWatchlist={handleAddToWatchlist}
            />
          )}

          {topRatedShows.length > 0 && (
            <Carousel
              title="Top Rated Shows"
              movies={topRatedShows}
              seeAllHref="/shows?sort=rating"
              onAddToWatchlist={handleAddToWatchlist}
            />
          )}

          {koreanShows.length > 0 && (
            <Carousel
              title="Korean Dramas & Shows"
              movies={koreanShows}
              seeAllHref="/shows?language=Korean"
              onAddToWatchlist={handleAddToWatchlist}
            />
          )}

          {japaneseShows.length > 0 && (
            <Carousel
              title="Japanese Shows & Anime"
              movies={japaneseShows}
              seeAllHref="/shows?language=Japanese"
              onAddToWatchlist={handleAddToWatchlist}
            />
          )}

          {hindiShows.length > 0 && (
            <Carousel
              title="Hindi Web Series"
              movies={hindiShows}
              seeAllHref="/shows?language=Hindi"
              onAddToWatchlist={handleAddToWatchlist}
            />
          )}
        </div>
      </main>
    </>
  )
}
