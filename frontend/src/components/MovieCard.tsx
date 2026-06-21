'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useCallback } from 'react'
import type { Movie } from '@/types/movie'
import { useTV } from '@/components/TvProvider'

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

// ─── TV Card ────────────────────────────────────────────────────────────────
// Zero Framer Motion — plain HTML + inline styles only.
// Android TV / Google TV / WebOS chipsets can't handle 100+ WAAPI instances.
// data-focusable is on the <a> so TvProvider's focused.click() navigates correctly.
function TvCard({ movie }: { movie: Movie }) {
  const [focused, setFocused] = useState(false)
  const isShow = movie.type === 'tvshow'
  const href   = isShow ? `/show/${movie.slug}` : `/movie/${movie.slug}`

  return (
    <div style={{ position: 'relative', zIndex: focused ? 50 : 1 }}>
      <Link
        href={href}
        data-focusable
        tabIndex={0}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="block outline-none rounded-xl"
        style={{
          display: 'block',
          borderRadius: '12px',
          // GPU-composited properties only — no layout reflow on focus
          transform: focused ? 'scale(1.08)' : 'scale(1)',
          transformOrigin: 'top center',
          boxShadow: focused
            ? '0 0 0 3px rgb(6,214,224), 0 0 28px rgba(6,214,224,0.45)'
            : 'none',
          // Instant — old TV browsers handle instant changes better than transitions
        }}
      >
        <div style={{ position: 'relative', aspectRatio: '2/3', borderRadius: '12px', overflow: 'hidden', background: 'var(--card)' }}>
          {movie.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={movie.posterUrl}
              alt={movie.title}
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--muted-foreground)', fontSize: '12px' }}>No Poster</span>
            </div>
          )}

          {/* Rating */}
          <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 7px', borderRadius: 6, background: 'rgba(0,0,0,0.7)' }}>
              <StarIcon />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>{movie.rating.toFixed(1)}</span>
            </div>
          </div>

          {/* Title always visible — TV has no hover */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '24px 10px 10px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.92) 60%, transparent)',
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {movie.title}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{movie.releaseYear}</span>
              {isShow && movie.seasons && (
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{movie.seasons}S</span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}

// ─── Regular Card (non-TV) ───────────────────────────────────────────────────
export default function MovieCard({ movie, onAddToWatchlist }: Props) {
  const [isHovered, setIsHovered] = useState(false)
  const isTV   = useTV()
  const router = useRouter()
  const isShow = movie.type === 'tvshow'
  const detailHref = isShow ? `/show/${movie.slug}` : `/movie/${movie.slug}`
  const watchHref  = isShow ? `/watch/show/${movie.slug}?season=1&episode=1` : `/watch/${movie.slug}`

  const handleAddToWatchlist = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onAddToWatchlist?.(movie)
  }, [movie, onAddToWatchlist])

  if (isTV) return <TvCard movie={movie} />

  return (
    <motion.div
      className="relative w-full group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={false}
    >
      <Link href={detailHref} className="block outline-none" style={{ WebkitTapHighlightColor: 'transparent' }}>
        <motion.div
          animate={{ scale: isHovered ? 1.03 : 1, zIndex: isHovered ? 20 : 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          style={{ transformOrigin: 'top center' }}
          className="relative rounded-xl"
        >
          {/* Poster */}
          <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-card">
            {movie.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={movie.posterUrl}
                alt={movie.title}
                className="object-cover w-full h-full transition-transform duration-500"
                loading="lazy"
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
                  className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/75 to-black/30"
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
                  <div className="flex flex-wrap gap-1 mb-2">
                    {movie.genres.slice(0, 2).map((genre) => (
                      <span key={genre} className="px-2 py-0.5 text-[10px] font-medium text-foreground/80 bg-white/10 rounded-full">
                        {genre}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold transition-all hover:shadow-glow-sm"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(watchHref) }}
                    >
                      <PlayIcon />
                      <span>Play</span>
                    </button>
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

            <div
              className="absolute inset-0 rounded-xl pointer-events-none z-30"
              style={{
                boxShadow: isHovered ? 'inset 0 0 0 2px rgb(6,214,224)' : 'inset 0 0 0 2px transparent',
                transition: 'box-shadow 0.2s ease',
              }}
            />
          </div>
        </motion.div>

        {/* Title and Meta */}
        <motion.div
          className="mt-3 px-1"
          animate={{ opacity: isHovered ? 0 : 1 }}
          transition={{ duration: 0.15 }}
        >
          <h3 className="text-sm font-medium text-foreground line-clamp-1 text-pretty">{movie.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">{movie.releaseYear}</span>
            <span className="w-1 h-1 rounded-full bg-muted" />
            <span className="text-xs text-muted-foreground">
              {isShow && movie.seasons ? `${movie.seasons}S` : movie.language[0]}
            </span>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  )
}
