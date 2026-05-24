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
  hindi: Movie[]
  english: Movie[]
  trendingShows: Movie[]
  latestShows: Movie[]
  hindiShows: Movie[]
  englishShows: Movie[]
}

export default function HomePageClient({ trending, latest, hindi, english, trendingShows, latestShows, hindiShows, englishShows }: Props) {
  const isTV = useTV()
  const { continueWatching, addToWatchlist, removeFromHistory } = useUserData()

  const handleAddToWatchlist = useCallback((movie: Movie) => {
    addToWatchlist(movie)
  }, [addToWatchlist])

  // 8-slide hero: interleave top 4 movies + top 4 shows (movie, show, movie, show…)
  const featuredItems: Movie[] = []
  const topMovies = trending.slice(0, 4)
  const topShows = trendingShows.slice(0, 4)
  for (let i = 0; i < 4; i++) {
    if (topMovies[i]) featuredItems.push(topMovies[i])
    if (topShows[i]) featuredItems.push(topShows[i])
  }
  const hero = featuredItems[0] ?? latest[0] ?? trending[0]

  return (
    <>
      <Sidebar />

      <main className={`min-h-screen pb-24 lg:pb-8 ${isTV ? '' : 'lg:pl-24'}`}>
        {hero && <Hero movie={hero} movies={featuredItems} />}

        <div className="relative -mt-20 z-10">
          {/* Continue Watching - Personal section */}
          {continueWatching.length > 0 && (
            <ContinueWatchingCarousel 
              items={continueWatching}
              onRemove={removeFromHistory}
            />
          )}

          {/* Trending Now */}
          <Carousel
            title="Trending Now"
            movies={trending}
            seeAllHref="/movies?sort=rating"
            onAddToWatchlist={handleAddToWatchlist}
          />

          {/* Latest Releases */}
          <Carousel
            title="Latest Releases"
            movies={latest}
            seeAllHref="/movies?sort=recent"
            onAddToWatchlist={handleAddToWatchlist}
          />

          {/* Hindi Movies */}
          {hindi.length > 0 && (
            <Carousel
              title="Hindi Movies"
              movies={hindi}
              seeAllHref="/movies?language=Hindi"
              onAddToWatchlist={handleAddToWatchlist}
            />
          )}

          {/* English Movies */}
          {english.length > 0 && (
            <Carousel
              title="English Movies"
              movies={english}
              seeAllHref="/movies?language=English"
              onAddToWatchlist={handleAddToWatchlist}
            />
          )}

          {/* ── TV Shows Section ── */}
          {(trendingShows.length > 0 || latestShows.length > 0) && (
            <div className="pt-4 pb-2 px-4 sm:px-6 lg:pl-24 lg:pr-8">
              <div className="flex items-center gap-3">
                <div className="w-1 h-5 bg-primary rounded-full" />
                <span className="text-xs font-semibold text-primary uppercase tracking-widest">TV Shows</span>
              </div>
            </div>
          )}

          {trendingShows.length > 0 && (
            <Carousel
              title="Trending Web Series"
              movies={trendingShows}
              seeAllHref="/shows?sort=rating"
              onAddToWatchlist={handleAddToWatchlist}
            />
          )}

          {latestShows.length > 0 && (
            <Carousel
              title="Latest Web Series"
              movies={latestShows}
              seeAllHref="/shows?sort=recent"
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

          {englishShows.length > 0 && (
            <Carousel
              title="English Web Series"
              movies={englishShows}
              seeAllHref="/shows?language=English"
              onAddToWatchlist={handleAddToWatchlist}
            />
          )}
        </div>
      </main>
    </>
  )
}
