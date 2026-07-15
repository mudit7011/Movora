'use client'

import { useUserData } from '@/lib/useUserData'
import { api } from '@/lib/api'
import type { Movie, Review } from '@/types/movie'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
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
  const { addToWatchlist, removeFromWatchlist, isInWatchlist, isCompleted, continueWatching } = useUserData()
  const inWatchlist = isInWatchlist(show._id)
  const watched = isCompleted(show._id)
  const watchProgress = continueWatching.find(p => p.movieId === show._id)
  const hasProgress = !!watchProgress
  // Season chosen in the episode grid — drives the main Watch button below.
  const [selSeason, setSelSeason] = useState(1)
  const [similar, setSimilar] = useState<Movie[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    api.getRelatedShows(show.slug).then(d => setSimilar(d.similar || [])).catch(() => {})
    api.getShowReviews(show.slug).then(d => setReviews(d.reviews || [])).catch(() => {})
  }, [show.slug])

  const handleWatchlistToggle = () => {
    if (inWatchlist) removeFromWatchlist(show._id)
    else addToWatchlist(show)
  }

  const seasons = show.seasonData?.filter(s => s.seasonNumber > 0) ?? []

  return (
    <div className="min-h-screen">
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
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-4 px-4 sm:px-6 lg:pl-24 lg:pr-8 pt-[calc(1.25rem_+_env(safe-area-inset-top))] pb-4">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-black/60 hover:border-white/20 transition-all duration-200 flex-shrink-0"
            aria-label="Go back"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <Link href="/" className="lg:hidden flex items-center gap-1.5 select-none">
            <span className="text-xl font-bold tracking-tight">
              <span className="text-foreground">Mo</span><span className="text-primary">vora</span>
            </span>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:pl-24 lg:pr-8 -mt-[40vh] z-10 pb-24 lg:pb-8">
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
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4 mb-8">
              <Link
                href={
                  hasProgress
                    ? `/watch/show/${show.slug}?season=${watchProgress!.season ?? 1}&episode=${watchProgress!.episode ?? 1}`
                    : `/watch/show/${show.slug}?season=${selSeason}&episode=1`
                }
                className="btn-primary inline-flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto px-8 py-4 rounded-xl text-base"
              >
                <PlayIcon />
                <span>
                  {hasProgress
                    ? `Resume S${watchProgress!.season ?? 1} E${watchProgress!.episode ?? 1}`
                    : watched ? 'Watch Again' : `Watch S${selSeason} E1`}
                </span>
              </Link>
              <button
                onClick={handleWatchlistToggle}
                className={`inline-flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto px-6 py-4 rounded-xl text-base transition-all ${
                  inWatchlist
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'btn-glass'
                }`}
              >
                {inWatchlist ? <CheckIcon /> : <PlusIcon />}
                <span>{inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}</span>
              </button>
            </div>
          </motion.div>
        </div>

        {/* Episodes / Cast / Trailer — full-width below the hero, aligned with More Like This & Reviews */}
            {/* Season/Episode selector */}
            {seasons.length > 0 && (
              <div className="mb-8">
                <EpisodeGrid
                  show={show}
                  currentSeason={selSeason}
                  currentEpisode={0}
                  onSeasonChange={setSelSeason}
                  onSelect={(s, ep) => router.push(`/watch/show/${show.slug}?season=${s}&episode=${ep}`)}
                />
              </div>
            )}

            {/* Cast */}
            {show.cast.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-5 rounded-full bg-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Cast</h2>
                  </div>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 xl:justify-center">
                  {show.cast.slice(0, 10).map((member, i) => (
                    <Link key={i} href={`/actor/${encodeURIComponent(member.name)}`} className="flex-shrink-0 text-center w-20 group">
                      <div className="w-16 h-16 mx-auto rounded-full overflow-hidden bg-card ring-1 ring-white/10 mb-2 group-hover:ring-primary/60 transition-all">
                        {member.photo ? (
                          <img src={member.photo} alt={member.name} width={64} height={64} className="object-cover w-full h-full group-hover:scale-105 transition-transform" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl text-muted">{member.name[0]}</div>
                        )}
                      </div>
                      <p className="text-xs text-foreground font-medium line-clamp-1 group-hover:text-primary transition-colors">{member.name}</p>
                      {member.character && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{member.character}</p>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Trailer */}
            {show.trailerKey && (
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-5 rounded-full bg-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Trailer</h2>
                  </div>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>
                <div className="relative aspect-video max-w-2xl mx-auto rounded-2xl overflow-hidden ring-1 ring-white/10">
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

        {/* More Like This — TMDB recommendations, filtered to shows we actually stream */}
        {similar.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full bg-primary" />
                <h2 className="text-lg font-semibold text-foreground">More Like This</h2>
              </div>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
              {similar.map(m => (
                <Link key={m._id} href={`/show/${m.slug}`} className="flex-shrink-0 w-36 group">
                  <div className="relative aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 group-hover:border-primary/50 group-hover:shadow-[0_0_16px_rgba(6,214,224,0.15)] transition-all duration-300">
                    {m.posterUrl ? (
                      <img src={m.posterUrl} alt={m.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full bg-card flex items-center justify-center text-muted-foreground text-sm">No Image</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                    {typeof m.rating === 'number' && m.rating > 0 && (
                      <div className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 bg-background/75 backdrop-blur-md text-gold text-[10px] font-bold px-2 py-1 rounded-lg border border-white/10">
                        <span>★</span><span>{m.rating.toFixed(1)}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <div className="w-10 h-10 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                        <svg className="w-4 h-4 text-background ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z" /></svg>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2.5 px-0.5">
                    <p className="text-xs font-semibold line-clamp-1 text-foreground group-hover:text-primary transition-colors">{m.title}</p>
                    <p className="text-[11px] mt-0.5 text-muted-foreground">{m.releaseYear}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Reviews (TMDB) */}
        {reviews.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full bg-primary" />
                <h2 className="text-lg font-semibold text-foreground">Reviews</h2>
              </div>
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-xs text-muted-foreground tabular-nums">{reviews.length}</span>
            </div>
            <div className="space-y-4">
              {reviews.map(r => {
                const isOpen = expanded.has(r.id)
                const long = r.content.length > 360
                return (
                  <div key={r.id} className="rounded-2xl bg-white/[0.03] border border-white/10 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-card ring-1 ring-white/10 flex-shrink-0">
                        {r.avatar ? (
                          <img src={r.avatar} alt={r.author} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">{r.author[0]?.toUpperCase()}</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground line-clamp-1">{r.author}</p>
                        {r.createdAt && <p className="text-[11px] text-muted-foreground">{new Date(r.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>}
                      </div>
                      {typeof r.rating === 'number' && (
                        <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-gold bg-black/40 px-2 py-1 rounded-lg">
                          <span>★</span><span>{r.rating}/10</span>
                        </span>
                      )}
                    </div>
                    <p className={`text-sm text-muted-foreground leading-relaxed whitespace-pre-line ${isOpen ? '' : 'line-clamp-4'}`}>
                      {r.content}
                    </p>
                    {long && (
                      <button
                        onClick={() => setExpanded(prev => { const n = new Set(prev); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n })}
                        className="mt-2 text-xs font-semibold text-primary hover:underline"
                      >
                        {isOpen ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
