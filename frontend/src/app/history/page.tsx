'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from '@/components/Sidebar'
import { useUserData } from '@/lib/useUserData'

const PlayIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5.14v14l11-7-11-7z" />
  </svg>
)

const TrashIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
)

const ClockIcon = () => (
  <svg className="w-16 h-16 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
)

export default function HistoryPage() {
  const { continueWatching, removeFromHistory, clearAllData } = useUserData()

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString()
  }

  return (
    <>
      <Sidebar />
      <div className="min-h-screen pt-8 pb-24 lg:pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:pl-28 lg:pr-8 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Continue Watching</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {continueWatching.length} {continueWatching.length === 1 ? 'movie' : 'movies'} in progress
              </p>
            </div>
            {continueWatching.length > 0 && (
              <button
                onClick={clearAllData}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          {continueWatching.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
                <ClockIcon />
              </div>
              <p className="text-lg text-foreground font-medium mb-2">No watch history</p>
              <p className="text-muted-foreground text-sm mb-6">Movies you start watching will appear here</p>
              <Link
                href="/movies"
                className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm"
              >
                Browse Movies
              </Link>
            </div>
          ) : (
            <motion.div 
              className="space-y-4"
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
                {continueWatching.map((item) => {
                  const progress = (item.timestamp / item.duration) * 100
                  const timeLeft = item.duration - item.timestamp

                  return (
                    <motion.div
                      key={item.movieId}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      className="group relative"
                    >
                      <Link 
                        href={`/watch/${item.slug}?t=${item.timestamp}`} 
                        className="flex gap-4 p-4 rounded-2xl bg-card/50 hover:bg-card transition-colors ring-1 ring-white/5 hover:ring-white/10"
                      >
                        {/* Thumbnail */}
                        <div className="relative w-32 sm:w-40 aspect-video rounded-xl overflow-hidden bg-card flex-shrink-0">
                          {item.posterUrl ? (
                            <Image
                              src={item.posterUrl}
                              alt={item.title}
                              fill
                              sizes="(max-width: 640px) 128px, 160px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-card" />
                          )}

                          {/* Progress Bar */}
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                            <div 
                              className="h-full bg-primary"
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>

                          {/* Play Icon Overlay */}
                          <div className="absolute inset-0 flex items-center justify-center bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                              <PlayIcon />
                            </div>
                          </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 py-1">
                          <h3 className="text-base font-medium text-foreground line-clamp-1 mb-1">
                            {item.title}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-2">
                            {formatTime(timeLeft)} remaining
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted">
                            <span>{Math.round(progress)}% watched</span>
                            <span>{formatDate(item.lastWatched)}</span>
                          </div>
                        </div>

                        {/* Remove Button */}
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            removeFromHistory(item.movieId)
                          }}
                          className="self-center p-2 rounded-lg bg-white/5 text-muted-foreground hover:bg-red-500/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                          aria-label="Remove from history"
                        >
                          <TrashIcon />
                        </button>
                      </Link>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>
    </>
  )
}
