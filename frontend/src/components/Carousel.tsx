'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { Movie } from '@/types/movie'
import MovieCard from './MovieCard'
import { useTV } from '@/components/TvProvider'

const ChevronLeftIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M15 19l-7-7 7-7" />
  </svg>
)

const ChevronRightIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 5l7 7-7 7" />
  </svg>
)

interface Props {
  title: string
  movies: Movie[]
  seeAllHref?: string
  onAddToWatchlist?: (movie: Movie) => void
}

export default function Carousel({ title, movies, seeAllHref, onAddToWatchlist }: Props) {
  const isTV = useTV()
  const trackRef = useRef<HTMLDivElement>(null)
  const [showLeft, setShowLeft]   = useState(false)
  const [showRight, setShowRight] = useState(true)

  const updateArrows = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setShowLeft(el.scrollLeft > 8)
    setShowRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8)
  }, [])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    updateArrows()
    el.addEventListener('scroll', updateArrows, { passive: true })
    const ro = new ResizeObserver(updateArrows)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', updateArrows); ro.disconnect() }
  }, [movies, updateArrows])

  const scroll = (dir: 'left' | 'right') => {
    trackRef.current?.scrollBy({ left: dir === 'left' ? -440 : 440, behavior: 'smooth' })
  }

  if (movies.length === 0) return null

  const atEnd = !showRight

  return (
    <section className="py-8 relative group/carousel">
      {/* Header */}
      <div className={`flex items-center justify-between mb-6 px-4 sm:px-6 ${isTV ? 'lg:px-16' : 'lg:pl-24 lg:pr-8'}`}>
        <h2 className="text-xl sm:text-2xl font-semibold text-foreground">{title}</h2>

        {/* Arrow buttons — desktop */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => scroll('left')}
            disabled={!showLeft}
            className={`p-2 rounded-full bg-white/5 border border-white/10 text-foreground transition-all duration-300 ${
              showLeft ? 'hover:bg-white/10 hover:border-white/20' : 'opacity-30 cursor-not-allowed'
            }`}
            aria-label="Scroll left"
          >
            <ChevronLeftIcon />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!showRight}
            className={`p-2 rounded-full bg-white/5 border border-white/10 text-foreground transition-all duration-300 ${
              showRight ? 'hover:bg-white/10 hover:border-white/20' : 'opacity-30 cursor-not-allowed'
            }`}
            aria-label="Scroll right"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      {/* Track wrapper — negative margin compensates for the pt-3 added to the track */}
      <div className={`relative -mt-3 ${isTV ? '' : 'lg:ml-24'}`}>
        {/* Left fade */}
        <div className={`absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none transition-opacity duration-300 ${showLeft ? 'opacity-100' : 'opacity-0'}`} />
        {/* Right fade */}
        <div className={`absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none transition-opacity duration-300 ${showRight ? 'opacity-100' : 'opacity-0'}`} />

        {/* Scrollable track — pt-3 gives headroom so overflow-x-auto's implicit
            overflow-y:auto doesn't clip the card top glow/border on hover */}
        <div
          ref={trackRef}
          className={`flex gap-4 overflow-x-auto no-scrollbar pt-3 pb-4 scroll-smooth ${
            isTV ? 'px-16 gap-6' : 'px-4 sm:px-6 lg:pl-2 lg:pr-8'
          }`}
          style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {movies.map((movie) => (
            <div
              key={movie._id}
              className="flex-shrink-0 w-[185px] sm:w-[210px]"
              style={{ scrollSnapAlign: 'start' }}
            >
              <MovieCard movie={movie} onAddToWatchlist={onAddToWatchlist} />
            </div>
          ))}

          {/* See All card */}
          {seeAllHref && (
            <div
              className="flex-shrink-0 w-[185px] sm:w-[210px]"
              style={{ scrollSnapAlign: 'start' }}
            >
              <Link
                href={seeAllHref}
                className={`flex flex-col items-center justify-center h-[277px] sm:h-[315px] rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-primary/40 transition-all duration-300 gap-3 group ${
                  atEnd ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                style={{ transition: 'opacity 0.4s ease' }}
              >
                <div className="w-12 h-12 rounded-full border border-white/20 group-hover:border-primary/60 flex items-center justify-center transition-colors duration-300">
                  <svg className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors duration-300">
                  See All
                </span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
