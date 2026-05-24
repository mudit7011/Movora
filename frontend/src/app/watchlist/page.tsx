'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from '@/components/Sidebar'
import { useUserData } from '@/lib/useUserData'

const PlayIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5.14v14l11-7-11-7z" />
  </svg>
)

const TrashIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
)

const BookmarkIcon = () => (
  <svg className="w-16 h-16 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
  </svg>
)

export default function WatchlistPage() {
  const { watchlist, removeFromWatchlist } = useUserData()

  return (
    <>
      <Sidebar />
      <div className="min-h-screen pt-8 pb-24 lg:pb-8 lg:pl-24">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Watch Later</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {watchlist.length} {watchlist.length === 1 ? 'movie' : 'movies'} saved
              </p>
            </div>
          </div>

          {watchlist.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
                <BookmarkIcon />
              </div>
              <p className="text-lg text-foreground font-medium mb-2">Your watchlist is empty</p>
              <p className="text-muted-foreground text-sm mb-6">Save movies to watch later</p>
              <Link
                href="/movies"
                className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm"
              >
                Browse Movies
              </Link>
            </div>
          ) : (
            <motion.div 
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: { 
                  opacity: 1,
                  transition: { staggerChildren: 0.05 }
                }
              }}
            >
              <AnimatePresence mode="popLayout">
                {watchlist.map((item) => (
                  <motion.div
                    key={item.movieId}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="group relative"
                  >
                    <Link href={item.type === 'tvshow' ? `/show/${item.slug}` : `/movie/${item.slug}`} className="block">
                      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-card ring-1 ring-white/10 group-hover:ring-primary/50 transition-all">
                        {item.posterUrl ? (
                          <Image
                            src={item.posterUrl}
                            alt={item.title}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-card flex items-center justify-center">
                            <span className="text-muted text-xs">No Poster</span>
                          </div>
                        )}

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                        {/* Quick Actions */}
                        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <Link
                            href={item.type === 'tvshow' ? `/watch/show/${item.slug}?season=1&episode=1` : `/watch/${item.slug}`}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <PlayIcon />
                            <span>Play</span>
                          </Link>
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              removeFromWatchlist(item.movieId)
                            }}
                            className="p-2 rounded-lg bg-white/10 text-foreground hover:bg-red-500/20 hover:text-red-400 transition-colors"
                            aria-label="Remove from watchlist"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 px-1">
                        <h3 className="text-sm font-medium text-foreground line-clamp-1">{item.title}</h3>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>
    </>
  )
}
