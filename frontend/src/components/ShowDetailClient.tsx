'use client'

import { useUserData } from '@/lib/useUserData'
import type { Movie } from '@/types/movie'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { motion } from 'framer-motion'
import EpisodeGrid from './EpisodeGrid'

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

interface Props {
  show: Movie
}

export default function ShowDetailClient({ show }: Props) {
  const router = useRouter()
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useUserData()
  const inWatchlist = isInWatchlist(show._id)

  const handleWatchlistToggle = () => {
    if (inWatchlist) removeFromWatchlist(show._id)
    else addToWatchlist(show)
  }

  const seasons = show.seasonData?.filter(s => s.seasonNumber > 0) ?? []

  return (
    <div className="min-h-screen lg:pl-24">
      {/* Hero Background */}
      <div className="relative h-[70vh] w-full overflow-hidden">
        {show.backdropUrl && (
          <motion.div
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="absolute inset-0"
          >
            <img
              src={show.backdropUrl}
              alt={show.title}
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
          </motion.div>
        )}

        <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-primary/30 blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/3 right-1/3 w-[200px] h-[200px] rounded-full bg-secondary/20 blur-[80px]" />

        <div className="absolute inset-0 bg-hero-gradient" />
        <div className="absolute inset-0 bg-hero-gradient-bottom" />
        <div className="grain absolute inset-0" />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-4 px-4 sm:px-6 lg:pl-28 lg:pr-8 pt-5 pb-4">
          <Link
            href="/shows"
            className="flex items-center justify-center w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-black/60 hover:border-white/20 transition-all duration-200 flex-shrink-0"
            aria-label="Back to shows"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <Link href="/" className="lg:hidden flex items-center gap-1.5 select-none">
            <span className="text-xl font-bold tracking-tight">
              <span className="text-foreground">Mo</span><span className="text-primary">vora</span>
            </span>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:pl-28 lg:pr-8 -mt-[40vh] z-10 pb-24 lg:pb-8">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Poster */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex-shrink-0 w-56 sm:w-64 lg:w-72 mx-auto lg:mx-0"
          >
            <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
              {show.posterUrl ? (
                <img
                  src={show.posterUrl}
                  alt={show.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-card" />
              )}
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
            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-3">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125z" />
              </svg>
              TV Series
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight leading-tight mb-4 text-balance">
              {show.title}
            </h1>

            {show.titleHindi && (
              <p className="text-lg text-muted-foreground mb-4">{show.titleHindi}</p>
            )}

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="flex items-center gap-2 text-accent">
                <StarIcon />
                <span className="text-lg font-semibold">{show.rating > 0 ? show.rating.toFixed(1) : 'N/A'}</span>
              </div>
              <span className="text-muted-foreground text-sm">{show.releaseYear}</span>
              {show.seasons && show.seasons > 0 && (
                <span className="text-muted-foreground text-sm">{show.seasons} Season{show.seasons !== 1 ? 's' : ''}</span>
              )}
              {show.totalEpisodes && show.totalEpisodes > 0 && (
                <span className="text-muted-foreground text-sm">{show.totalEpisodes} Episodes</span>
              )}
              {show.status && (
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  show.status === 'Ended' || show.status === 'Canceled'
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                  {show.status}
                </span>
              )}
            </div>

            {/* Genres & Languages */}
            <div className="flex flex-wrap gap-2 mb-6">
              {show.genres.map((genre) => (
                <span key={genre} className="px-3 py-1.5 text-sm font-medium text-foreground/90 bg-white/5 backdrop-blur-sm rounded-full border border-white/10">
                  {genre}
                </span>
              ))}
              {show.language.map((lang) => (
                <span key={lang} className="px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 rounded-full border border-primary/20">
                  {lang}
                </span>
              ))}
            </div>

            {/* Synopsis */}
            <p className="text-muted-foreground text-base leading-relaxed max-w-2xl mb-8">
              {show.synopsis}
            </p>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-4 mb-8">
              <Link
                href={`/watch/show/${show.slug}?season=1&episode=1`}
                className="btn-primary inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base"
              >
                <PlayIcon />
                <span>Watch S1 E1</span>
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

            {/* Season/Episode selector */}
            {seasons.length > 0 && (
              <div className="mb-8">
                <EpisodeGrid
                  show={show}
                  currentSeason={1}
                  currentEpisode={0}
                  onSelect={(s, ep) => router.push(`/watch/show/${show.slug}?season=${s}&episode=${ep}`)}
                />
              </div>
            )}

            {/* Cast */}
            {show.cast.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-foreground mb-4">Cast</h2>
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                  {show.cast.slice(0, 10).map((member, i) => (
                    <div key={i} className="flex-shrink-0 text-center w-20">
                      <div className="w-16 h-16 mx-auto rounded-full overflow-hidden bg-card ring-1 ring-white/10 mb-2">
                        {member.photo ? (
                          <img src={member.photo} alt={member.name} width={64} height={64} className="object-cover w-full h-full" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl text-muted">{member.name[0]}</div>
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

            {/* Trailer */}
            {show.trailerKey && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4">Trailer</h2>
                <div className="relative aspect-video max-w-2xl rounded-2xl overflow-hidden ring-1 ring-white/10">
                  <iframe
                    src={`https://www.youtube.com/embed/${show.trailerKey}`}
                    title={`${show.title} Trailer`}
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
