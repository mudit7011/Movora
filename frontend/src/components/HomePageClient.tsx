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
  nowPlaying: Movie[]
  popularMovies: Movie[]
  topRatedMovies: Movie[]
  hindiMovies: Movie[]
  koreanMovies: Movie[]
  japaneseMovies: Movie[]
  trendingShows: Movie[]
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
  trending, nowPlaying, popularMovies, topRatedMovies, hindiMovies, koreanMovies, japaneseMovies,
  trendingShows, popularShows, topRatedShows, hindiShows, koreanShows, japaneseShows,
}: Props) {
  const isTV = useTV()
  const { continueWatching, addToWatchlist, removeFromHistory } = useUserData()
  const handleAddToWatchlist = useCallback((movie: Movie) => addToWatchlist(movie), [addToWatchlist])

  // Hero: daily-rotating window mixing trending movies + shows
  const daySeed  = Math.floor(Date.now() / 86400000)
  const mOff     = trending.length > 4 ? daySeed % (trending.length - 3) : 0
  const sOff     = trendingShows.length > 4 ? (daySeed + 3) % (trendingShows.length - 3) : 0
  const topMovies = trending.slice(mOff, mOff + 4)
  const topShows  = trendingShows.slice(sOff, sOff + 4)
  const featuredItems: Movie[] = []
  for (let i = 0; i < 4; i++) {
    if (topMovies[i]) featuredItems.push(topMovies[i])
    if (topShows[i])  featuredItems.push(topShows[i])
  }
  const hero = featuredItems[0] ?? nowPlaying[0] ?? trending[0]

  return (
    <>
      <Sidebar />
      <main className={`min-h-screen pb-24 lg:pb-8 ${isTV ? 'pt-20' : ''}`}>
        {hero && <Hero movie={hero} movies={featuredItems} />}

        <div className="relative -mt-20 z-10">
          {continueWatching.length > 0 && (
            <ContinueWatchingCarousel items={continueWatching} onRemove={removeFromHistory} onComplete={removeFromHistory} />
          )}

          {/* ── Movies ── */}
          <SectionDivider label="Movies" />

          {trending.length > 0 && (
            <Carousel title="Trending This Week" movies={trending}
              seeAllHref="/category?type=movies&cat=trending&title=Trending+Movies+This+Week" onAddToWatchlist={handleAddToWatchlist} />
          )}
          {nowPlaying.length > 0 && (
            <Carousel title="New in Cinemas" movies={nowPlaying}
              seeAllHref="/category?type=movies&cat=now-playing&title=New+in+Cinemas" onAddToWatchlist={handleAddToWatchlist} />
          )}
          {popularMovies.length > 0 && (
            <Carousel title="Popular Movies" movies={popularMovies}
              seeAllHref="/category?type=movies&cat=popular&title=Popular+Movies" onAddToWatchlist={handleAddToWatchlist} />
          )}
          {topRatedMovies.length > 0 && (
            <Carousel title="Top Rated Movies" movies={topRatedMovies}
              seeAllHref="/category?type=movies&cat=top-rated&title=Top+Rated+Movies" onAddToWatchlist={handleAddToWatchlist} />
          )}
          {hindiMovies.length > 0 && (
            <Carousel title="Hindi Movies" movies={hindiMovies}
              seeAllHref="/category?type=movies&cat=hindi&title=Hindi+Movies" onAddToWatchlist={handleAddToWatchlist} />
          )}
          {koreanMovies.length > 0 && (
            <Carousel title="Korean Movies" movies={koreanMovies}
              seeAllHref="/category?type=movies&cat=korean&title=Korean+Movies" onAddToWatchlist={handleAddToWatchlist} />
          )}
          {japaneseMovies.length > 0 && (
            <Carousel title="Japanese Movies" movies={japaneseMovies}
              seeAllHref="/category?type=movies&cat=japanese&title=Japanese+Movies" onAddToWatchlist={handleAddToWatchlist} />
          )}

          {/* ── TV Shows ── */}
          <SectionDivider label="TV Shows" />

          {trendingShows.length > 0 && (
            <Carousel title="Trending This Week" movies={trendingShows}
              seeAllHref="/category?type=shows&cat=trending&title=Trending+Shows+This+Week" onAddToWatchlist={handleAddToWatchlist} />
          )}
          {popularShows.length > 0 && (
            <Carousel title="Popular Shows" movies={popularShows}
              seeAllHref="/category?type=shows&cat=popular&title=Popular+Shows" onAddToWatchlist={handleAddToWatchlist} />
          )}
          {topRatedShows.length > 0 && (
            <Carousel title="Top Rated Shows" movies={topRatedShows}
              seeAllHref="/category?type=shows&cat=top-rated&title=Top+Rated+Shows" onAddToWatchlist={handleAddToWatchlist} />
          )}
          {koreanShows.length > 0 && (
            <Carousel title="Korean Dramas & Shows" movies={koreanShows}
              seeAllHref="/category?type=shows&cat=korean&title=Korean+Dramas+%26+Shows" onAddToWatchlist={handleAddToWatchlist} />
          )}
          {japaneseShows.length > 0 && (
            <Carousel title="Japanese Shows & Anime" movies={japaneseShows}
              seeAllHref="/category?type=shows&cat=japanese&title=Japanese+Shows+%26+Anime" onAddToWatchlist={handleAddToWatchlist} />
          )}
          {hindiShows.length > 0 && (
            <Carousel title="Hindi Web Series" movies={hindiShows}
              seeAllHref="/category?type=shows&cat=hindi&title=Hindi+Web+Series" onAddToWatchlist={handleAddToWatchlist} />
          )}
        </div>
      </main>
    </>
  )
}
