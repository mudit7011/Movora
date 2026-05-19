'use client'

import { useCallback } from 'react'
import Hero from '@/components/Hero'
import Carousel from '@/components/Carousel'
import ContinueWatchingCarousel from '@/components/ContinueWatchingCarousel'
import Sidebar from '@/components/Sidebar'
import { useUserData } from '@/lib/useUserData'
import type { Movie } from '@/types/movie'

interface Props {
  trending: Movie[]
  latest: Movie[]
  hindi: Movie[]
  dubbed: Movie[]
  english: Movie[]
}

export default function HomePageClient({ trending, latest, hindi, dubbed, english }: Props) {
  const { continueWatching, addToWatchlist, removeFromHistory } = useUserData()

  const handleAddToWatchlist = useCallback((movie: Movie) => {
    addToWatchlist(movie)
  }, [addToWatchlist])

  const hero = trending[0] ?? latest[0]

  return (
    <>
      <Sidebar />
      
      <main className="min-h-screen pb-24 lg:pb-8">
        {hero && <Hero movie={hero} movies={trending.slice(0, 5)} />}

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
            onAddToWatchlist={handleAddToWatchlist}
          />

          {/* Latest Releases */}
          <Carousel 
            title="Latest Releases" 
            movies={latest} 
            onAddToWatchlist={handleAddToWatchlist}
          />

          {/* Hindi Movies */}
          {hindi.length > 0 && (
            <Carousel 
              title="Hindi Movies" 
              movies={hindi} 
              onAddToWatchlist={handleAddToWatchlist}
            />
          )}

          {/* Hindi Dubbed */}
          {dubbed.length > 0 && (
            <Carousel 
              title="Hindi Dubbed" 
              movies={dubbed} 
              onAddToWatchlist={handleAddToWatchlist}
            />
          )}

          {/* English Movies */}
          {english.length > 0 && (
            <Carousel 
              title="English Movies" 
              movies={english} 
              onAddToWatchlist={handleAddToWatchlist}
            />
          )}
        </div>
      </main>
    </>
  )
}
