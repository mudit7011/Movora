'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useCallback } from 'react'
import type { Movie } from '@/types/movie'

const PlayIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5.14v14l11-7-11-7z" />
  </svg>
)

const PlusIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const StarIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
)

interface Props {
  movie: Movie
  onAddToWatchlist?: (movie: Movie) => void
}

export default function MovieCard({ movie, onAddToWatchlist }: Props) {
  const [isHovered, setIsHovered] = useState(false)

  const handleAddToWatchlist = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onAddToWatchlist?.(movie)
  }, [movie, onAddToWatchlist])

  return (
    <motion.div
      className="relative flex-shrink-0 w-[160px] sm:w-[180px] group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={false}
    >
      <Link href={`/movie/${movie.slug}`} className="block">
        <motion.div
          animate={{ 
            scale: isHovered ? 1.05 : 1,
            zIndex: isHovered ? 20 : 1,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="relative"
        >
          {/* Poster */}
          <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-card">
            {movie.posterUrl ? (
              <Image
                src={movie.posterUrl}
                alt={movie.title}
                fill
                sizes="(max-width: 640px) 160px, 180px"
                className="object-cover transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full bg-card flex items-center justify-center">
                <span className="text-muted text-xs">No Poster</span>
              </div>
            )}

            {/* Hover Overlay */}
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent"
                />
              )}
            </AnimatePresence>

            {/* Rating Badge */}
            <div className="absolute top-2 right-2 z-10">
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-background/80 backdrop-blur-sm">
                <StarIcon />
                <span className="text-xs font-semibold text-accent">{movie.rating.toFixed(1)}</span>
              </div>
            </div>

            {/* Hover Content */}
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                  className="absolute bottom-0 left-0 right-0 p-3 z-10"
                >
                  {/* Genres */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {movie.genres.slice(0, 2).map((genre) => (
                      <span
                        key={genre}
                        className="px-2 py-0.5 text-[10px] font-medium text-foreground/80 bg-white/10 rounded-full"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/watch/${movie.slug}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold transition-all hover:shadow-glow-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <PlayIcon />
                      <span>Play</span>
                    </Link>
                    <button
                      onClick={handleAddToWatchlist}
                      className="p-2 rounded-lg bg-white/10 text-foreground hover:bg-white/20 transition-colors"
                      aria-label="Add to Watch Later"
                    >
                      <PlusIcon />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Glow effect on hover */}
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute -inset-1 rounded-xl bg-primary/20 blur-xl -z-10"
                />
              )}
            </AnimatePresence>
          </div>

          {/* Border ring */}
          <motion.div
            animate={{
              opacity: isHovered ? 1 : 0,
            }}
            className="absolute inset-0 rounded-xl ring-2 ring-primary/50 pointer-events-none"
          />
        </motion.div>

        {/* Title and Meta */}
        <motion.div 
          className="mt-3 px-1"
          animate={{ opacity: isHovered ? 0 : 1 }}
          transition={{ duration: 0.15 }}
        >
          <h3 className="text-sm font-medium text-foreground line-clamp-1 text-pretty">
            {movie.title}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">{movie.releaseYear}</span>
            <span className="w-1 h-1 rounded-full bg-muted" />
            <span className="text-xs text-muted-foreground">{movie.language[0]}</span>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  )
}
