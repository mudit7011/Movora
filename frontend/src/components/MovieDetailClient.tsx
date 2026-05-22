'use client'

import { useUserData } from '@/lib/useUserData'
import type { Movie } from '@/types/movie'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

interface CollectionPart {
  tmdbId: string
  title: string
  posterUrl: string
  year: number
  slug: string
  partNumber: number
  collectionName: string
}

const PlayIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5.14v14l11-7-11-7z" />
  </svg>
)

const PlusIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 6L9 17l-5-5" />
  </svg>
)

const StarIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
)

const CalendarIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const ClockIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
)

interface Props {
  movie: Movie
}

export default function MovieDetailClient({ movie }: Props) {
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useUserData()
  const inWatchlist = isInWatchlist(movie._id)
  const [collection, setCollection] = useState<CollectionPart[]>([])

  useEffect(() => {
    fetch(`/api/collection?tmdbId=${encodeURIComponent(movie.tmdbId)}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 1) setCollection(data) })
      .catch(() => {})
  }, [movie.tmdbId])

  const handleWatchlistToggle = () => {
    if (inWatchlist) {
      removeFromWatchlist(movie._id)
    } else {
      addToWatchlist(movie)
    }
  }

  return (
    <div className="min-h-screen lg:pl-24">
      {/* Hero Background */}
      <div className="relative h-[70vh] w-full overflow-hidden">
        {movie.backdropUrl && (
          <motion.div
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="absolute inset-0"
          >
            <Image
              src={movie.backdropUrl}
              alt={movie.title}
              fill
              priority
              sizes="100vw"
              className="object-cover object-top"
            />
          </motion.div>
        )}

        {/* Bokeh Effects */}
        <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-primary/30 blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/3 right-1/3 w-[200px] h-[200px] rounded-full bg-secondary/20 blur-[80px]" />

        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-hero-gradient" />
        <div className="absolute inset-0 bg-hero-gradient-bottom" />
        <div className="grain absolute inset-0" />

        {/* Top Bar — Back + Logo */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-4 px-4 sm:px-6 lg:pl-28 lg:pr-8 pt-5 pb-4">
          <Link
            href="/"
            className="flex items-center justify-center w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-black/60 hover:border-white/20 transition-all duration-200 flex-shrink-0"
            aria-label="Go home"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          <Link href="/" className="flex items-center gap-1.5 select-none">
            <span className="text-xl font-bold tracking-tight">
              <span className="text-foreground">Mo</span><span className="text-primary">vora</span>
            </span>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:pl-28 lg:pr-8 -mt-[40vh] z-10 pb-20">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Poster */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex-shrink-0 w-56 sm:w-64 lg:w-72 mx-auto lg:mx-0"
          >
            <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
              {movie.posterUrl ? (
                <Image 
                  src={movie.posterUrl} 
                  alt={movie.title} 
                  fill 
                  sizes="(max-width: 1024px) 256px, 288px" 
                  className="object-cover" 
                />
              ) : (
                <div className="w-full h-full bg-card" />
              )}
              
              {/* Glow effect */}
              <div className="absolute -inset-2 rounded-2xl bg-primary/20 blur-2xl -z-10 opacity-50" />
            </div>
          </motion.div>

          {/* Details */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex-1 min-w-0 pt-4"
          >
            {/* Title */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight leading-tight mb-4 text-balance">
              {movie.title}
            </h1>

            {movie.titleHindi && (
              <p className="text-lg text-muted-foreground mb-4">{movie.titleHindi}</p>
            )}

            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="flex items-center gap-2 text-accent">
                <StarIcon />
                <span className="text-lg font-semibold">{movie.rating.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarIcon />
                <span className="text-sm">{movie.releaseYear}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <ClockIcon />
                <span className="text-sm">{movie.runtime} min</span>
              </div>
            </div>

            {/* Genres & Languages */}
            <div className="flex flex-wrap gap-2 mb-6">
              {movie.genres.map((genre) => (
                <span
                  key={genre}
                  className="px-3 py-1.5 text-sm font-medium text-foreground/90 bg-white/5 backdrop-blur-sm rounded-full border border-white/10"
                >
                  {genre}
                </span>
              ))}
              {movie.language.map((lang) => (
                <span
                  key={lang}
                  className="px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 rounded-full border border-primary/20"
                >
                  {lang}
                </span>
              ))}
            </div>

            {/* Synopsis */}
            <p className="text-muted-foreground text-base leading-relaxed max-w-2xl mb-8">
              {movie.synopsis}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 mb-8">
              <Link
                href={`/watch/${movie.slug}`}
                className="btn-primary inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base"
              >
                <PlayIcon />
                <span>Watch Now</span>
              </Link>
              <button
                onClick={handleWatchlistToggle}
                className={`inline-flex items-center gap-2 px-6 py-4 rounded-xl text-base transition-all ${
                  inWatchlist
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'btn-glass'
                }`}
              >
                {inWatchlist ? <CheckIcon /> : <PlusIcon />}
                <span>{inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}</span>
              </button>
            </div>

            {/* Cast Section */}
            {movie.cast.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-foreground mb-4">Cast</h2>
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                  {movie.cast.slice(0, 10).map((member, i) => (
                    <div key={i} className="flex-shrink-0 text-center w-20">
                      <div className="w-16 h-16 mx-auto rounded-full overflow-hidden bg-card ring-1 ring-white/10 mb-2">
                        {member.photo ? (
                          <Image 
                            src={member.photo} 
                            alt={member.name} 
                            width={64} 
                            height={64} 
                            className="object-cover w-full h-full" 
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl text-muted">
                            {member.name[0]}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-foreground font-medium line-clamp-1">{member.name}</p>
                      {member.character && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{member.character}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Series / Collection */}
            {collection.length > 1 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  {collection[0].collectionName}
                </h2>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {collection.map(part => {
                    const isCurrent = part.tmdbId === movie.tmdbId.replace(/^(tv_|movie_)/, '')
                    return (
                      <Link
                        key={part.tmdbId}
                        href={`/movie/${part.slug}`}
                        className={`flex-shrink-0 w-28 group ${isCurrent ? 'pointer-events-none' : ''}`}
                      >
                        <div className={`relative aspect-[2/3] rounded-xl overflow-hidden ring-2 transition-all ${
                          isCurrent ? 'ring-primary' : 'ring-white/10 group-hover:ring-primary/60'
                        }`}>
                          {part.posterUrl ? (
                            <Image src={part.posterUrl} alt={part.title} fill sizes="112px" className="object-cover" />
                          ) : (
                            <div className="w-full h-full bg-card" />
                          )}
                          {isCurrent && (
                            <div className="absolute inset-0 bg-primary/20 flex items-end justify-center pb-2">
                              <span className="text-[10px] font-bold text-primary bg-background/80 px-2 py-0.5 rounded-full">Watching</span>
                            </div>
                          )}
                          <div className="absolute top-1.5 left-1.5 bg-background/80 backdrop-blur-sm text-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                            Part {part.partNumber}
                          </div>
                        </div>
                        <p className="text-xs text-foreground font-medium mt-2 line-clamp-1">{part.title}</p>
                        <p className="text-[10px] text-muted-foreground">{part.year}</p>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Trailer Section */}
            {movie.trailerKey && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4">Trailer</h2>
                <div className="relative aspect-video max-w-2xl rounded-2xl overflow-hidden ring-1 ring-white/10">
                  <iframe
                    src={`https://www.youtube.com/embed/${movie.trailerKey}`}
                    title={`${movie.title} Trailer`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                  />
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
