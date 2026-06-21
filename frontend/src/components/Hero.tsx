'use client'

import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Movie } from '@/types/movie'
import { useUserData } from '@/lib/useUserData'
import { useTV } from '@/components/TvProvider'

const PlayIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5.14v14l11-7-11-7z" />
  </svg>
)

const InfoIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
)

const PlusIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const ChevronLeftIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
)

const ChevronRightIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
)

interface Props {
  movie: Movie
  movies?: Movie[]
}

function extractDominantColor(index: number): string {
  // Cinematic color palette for bokeh effects
  const colors = [
    'rgba(6, 214, 224, 0.6)',   // Cyan
    'rgba(20, 184, 166, 0.5)',  // Teal
    'rgba(99, 102, 241, 0.5)',  // Indigo
    'rgba(168, 85, 247, 0.4)',  // Purple
    'rgba(236, 72, 153, 0.4)',  // Pink
  ]
  return colors[index % colors.length]
}

export default function Hero({ movie, movies = [] }: Props) {
  const isTV = useTV()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [rotateKey, setRotateKey] = useState(0)
  const featuredMovies = movies.length > 0 ? movies.slice(0, 8) : [movie]
  const currentMovie = featuredMovies[currentIndex]
  const isShow = currentMovie.type === 'tvshow'
  const watchHref = isShow
    ? `/watch/show/${currentMovie.slug}?season=1&episode=1`
    : `/watch/${currentMovie.slug}`
  const detailHref = isShow ? `/show/${currentMovie.slug}` : `/movie/${currentMovie.slug}`

  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useUserData()
  const inWatchlist = isInWatchlist(currentMovie._id)

  const handleWatchlistToggle = () => {
    if (inWatchlist) removeFromWatchlist(currentMovie._id)
    else addToWatchlist(currentMovie)
  }

  const goTo = useCallback((index: number) => {
    setCurrentIndex(index)
    setRotateKey(k => k + 1) // reset auto-rotate timer
  }, [])

  const goPrev = useCallback(() => goTo((currentIndex - 1 + featuredMovies.length) % featuredMovies.length), [currentIndex, featuredMovies.length, goTo])
  const goNext = useCallback(() => goTo((currentIndex + 1) % featuredMovies.length), [currentIndex, featuredMovies.length, goTo])

  // Auto-rotate through featured movies — resets when user manually navigates
  useEffect(() => {
    if (featuredMovies.length <= 1) return
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredMovies.length)
    }, 8000)
    return () => clearInterval(timer)
  }, [featuredMovies.length, rotateKey])

  // Generate bokeh positions
  const bokehElements = useMemo(() => [
    { size: 300, x: '70%', y: '20%', color: extractDominantColor(0), delay: 0 },
    { size: 200, x: '80%', y: '60%', color: extractDominantColor(1), delay: 2 },
    { size: 250, x: '60%', y: '80%', color: extractDominantColor(2), delay: 4 },
  ], [])

  return (
    <section className="relative h-screen w-full overflow-hidden">
      {/* Background Image with Ken Burns Effect */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentMovie._id}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="absolute inset-0"
        >
          {currentMovie.backdropUrl && (
            <img
              key={currentMovie._id}
              src={currentMovie.backdropUrl}
              alt={currentMovie.title}
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Bokeh Glow Effects */}
      {bokehElements.map((bokeh, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            delay: bokeh.delay,
            ease: 'easeInOut',
          }}
          style={{
            width: bokeh.size,
            height: bokeh.size,
            left: bokeh.x,
            top: bokeh.y,
            background: `radial-gradient(circle, ${bokeh.color} 0%, transparent 70%)`,
          }}
          className="absolute rounded-full blur-3xl pointer-events-none mix-blend-screen"
        />
      ))}

      {/* Gradient Overlays */}
      <div className="absolute inset-0 bg-hero-gradient" />
      <div className="absolute inset-0 bg-hero-gradient-bottom" />

      {/* Grain Overlay */}
      <div className="grain absolute inset-0" />

      {/* Movora Logo — top left (hidden in TV mode; TvNavbar already shows it) */}
      {!isTV && (
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center px-4 sm:px-6 lg:pl-28 lg:pr-8 pt-[calc(1.25rem_+_env(safe-area-inset-top))]">
          <Link href="/" className="select-none">
            <span className="text-2xl font-bold tracking-tight">
              <span className="text-foreground">Mo</span><span className="text-primary">vora</span>
            </span>
          </Link>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-end lg:pl-24 pb-32 lg:pb-24">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentMovie._id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
              className="max-w-2xl"
            >
              {/* Meta Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex flex-wrap items-center gap-3 mb-4"
              >
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-semibold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  {isShow ? 'TV Series' : 'Featured'}
                </span>
                <span className="text-muted-foreground text-sm">{currentMovie.releaseYear}</span>
                {isShow
                  ? currentMovie.seasons && currentMovie.seasons > 0 && (
                      <span className="text-muted-foreground text-sm">{currentMovie.seasons} Season{currentMovie.seasons !== 1 ? 's' : ''}</span>
                    )
                  : currentMovie.runtime > 0 && (
                      <span className="text-muted-foreground text-sm">{currentMovie.runtime} min</span>
                    )
                }
                <span className="flex items-center gap-1 text-accent text-sm font-medium">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  {currentMovie.rating.toFixed(1)}
                </span>
              </motion.div>

              {/* Title */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-4xl sm:text-5xl lg:text-7xl font-bold text-foreground tracking-tight leading-[1.1] mb-4 text-balance"
              >
                {currentMovie.title}
              </motion.h1>

              {/* Genres */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-wrap gap-2 mb-5"
              >
                {currentMovie.genres.slice(0, 4).map((genre) => (
                  <span
                    key={genre}
                    className="px-3 py-1 text-xs font-medium text-foreground/80 bg-white/10 backdrop-blur-sm rounded-full border border-white/10"
                  >
                    {genre}
                  </span>
                ))}
              </motion.div>

              {/* Synopsis */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-muted-foreground text-sm sm:text-base leading-relaxed line-clamp-3 mb-8 max-w-xl"
              >
                {currentMovie.synopsis}
              </motion.p>

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex flex-wrap items-center gap-4"
              >
                <Link
                  href={watchHref}
                  data-focusable={isTV ? '' : undefined}
                  tabIndex={isTV ? 0 : undefined}
                  className="btn-primary inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base outline-none"
                >
                  <PlayIcon />
                  <span>Watch Now</span>
                </Link>
                <Link
                  href={detailHref}
                  data-focusable={isTV ? '' : undefined}
                  tabIndex={isTV ? 0 : undefined}
                  className="btn-glass inline-flex items-center gap-2 px-6 py-4 rounded-xl text-base outline-none"
                >
                  <InfoIcon />
                  <span>More Info</span>
                </Link>
                <motion.button
                  onClick={handleWatchlistToggle}
                  whileTap={{ scale: 0.92 }}
                  className={`relative p-4 rounded-xl transition-all duration-200 ${
                    inWatchlist
                      ? 'bg-primary text-background shadow-[0_0_20px_rgba(6,214,224,0.4)]'
                      : 'btn-glass'
                  }`}
                  aria-label={inWatchlist ? 'Remove from Watch Later' : 'Add to Watch Later'}
                >
                  <AnimatePresence mode="wait">
                    {inWatchlist ? (
                      <motion.span
                        key="check"
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      >
                        <CheckIcon />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="plus"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      >
                        <PlusIcon />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </motion.div>
            </motion.div>
          </AnimatePresence>

          {/* Dots + Arrows */}
          {featuredMovies.length > 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex items-center gap-3 mt-10"
            >
              {/* Prev */}
              <button
                onClick={goPrev}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-black/60 hover:border-white/20 transition-all duration-200"
                aria-label="Previous"
              >
                <ChevronLeftIcon />
              </button>

              {/* Dots */}
              <div className="flex items-center gap-2">
                {featuredMovies.map((m, i) => (
                  <button
                    key={m._id}
                    onClick={() => goTo(i)}
                    className={`relative h-1 rounded-full transition-all duration-500 ${
                      i === currentIndex ? 'w-10 bg-primary' : 'w-6 bg-white/20 hover:bg-white/40'
                    }`}
                    aria-label={`View ${m.title}`}
                  >
                    {i === currentIndex && (
                      <motion.div
                        layoutId="heroProgress"
                        className="absolute inset-0 bg-primary rounded-full"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Next */}
              <button
                onClick={goNext}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-black/60 hover:border-white/20 transition-all duration-200"
                aria-label="Next"
              >
                <ChevronRightIcon />
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Bottom Fade for Carousel Section */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </section>
  )
}
