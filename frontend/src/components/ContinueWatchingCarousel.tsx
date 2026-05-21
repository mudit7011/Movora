'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion, useMotionValue, useSpring, PanInfo } from 'framer-motion'
import { useRef, useState, useEffect } from 'react'

const PlayIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5.14v14l11-7-11-7z" />
  </svg>
)

const XIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)

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

interface WatchProgress {
  movieId: string
  slug: string
  title: string
  posterUrl: string
  backdropUrl?: string
  type?: 'movie' | 'tvshow'
  timestamp: number
  duration: number
  lastWatched: number
  season?: number
  episode?: number
}

interface Props {
  items: WatchProgress[]
  onRemove?: (movieId: string) => void
}

export default function ContinueWatchingCarousel({ items, onRemove }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [constraints, setConstraints] = useState({ left: 0, right: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(true)

  const x = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 300, damping: 30 })

  useEffect(() => {
    const updateConstraints = () => {
      if (!containerRef.current) return
      const containerWidth = containerRef.current.scrollWidth
      const viewportWidth = containerRef.current.offsetWidth
      const maxScroll = Math.max(0, containerWidth - viewportWidth)
      setConstraints({ left: -maxScroll, right: 0 })
      setShowRightArrow(maxScroll > 0)
    }

    updateConstraints()
    window.addEventListener('resize', updateConstraints)
    return () => window.removeEventListener('resize', updateConstraints)
  }, [items])

  useEffect(() => {
    const unsubscribe = x.on('change', (latest) => {
      setShowLeftArrow(latest < -10)
      setShowRightArrow(latest > constraints.left + 10)
    })
    return () => unsubscribe()
  }, [x, constraints.left])

  const scroll = (direction: 'left' | 'right') => {
    const scrollAmount = 400
    const currentX = x.get()
    const newX = direction === 'left'
      ? Math.min(currentX + scrollAmount, 0)
      : Math.max(currentX - scrollAmount, constraints.left)
    x.set(newX)
  }

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false)
    const velocity = info.velocity.x
    const currentX = x.get()
    const momentum = velocity * 0.2
    const targetX = Math.max(constraints.left, Math.min(0, currentX + momentum))
    x.set(targetX)
  }

  if (items.length === 0) return null

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <section className="py-8 relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-4 sm:px-6 lg:pl-24 lg:pr-8">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
            Continue Watching
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Pick up where you left off</p>
        </div>
        
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => scroll('left')}
            disabled={!showLeftArrow}
            className={`p-2 rounded-full bg-white/5 border border-white/10 text-foreground transition-all duration-300 ${
              showLeftArrow ? 'hover:bg-white/10 hover:border-white/20' : 'opacity-30 cursor-not-allowed'
            }`}
            aria-label="Scroll left"
          >
            <ChevronLeftIcon />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!showRightArrow}
            className={`p-2 rounded-full bg-white/5 border border-white/10 text-foreground transition-all duration-300 ${
              showRightArrow ? 'hover:bg-white/10 hover:border-white/20' : 'opacity-30 cursor-not-allowed'
            }`}
            aria-label="Scroll right"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      {/* Carousel */}
      <div className="relative overflow-hidden">
        <div className={`absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none transition-opacity duration-300 ${showLeftArrow ? 'opacity-100' : 'opacity-0'}`} />
        <div className={`absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none transition-opacity duration-300 ${showRightArrow ? 'opacity-100' : 'opacity-0'}`} />

        <motion.div
          ref={containerRef}
          style={{ x: springX }}
          drag="x"
          dragConstraints={constraints}
          dragElastic={0.1}
          dragTransition={{ bounceStiffness: 300, bounceDamping: 30 }}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={handleDragEnd}
          className={`flex gap-4 px-4 sm:px-6 lg:pl-24 lg:pr-8 pb-4 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          {items.map((item) => {
            const progress = (item.timestamp / item.duration) * 100
            const timeLeft = item.duration - item.timestamp
            const watchHref = item.type === 'tvshow'
              ? `/watch/show/${item.slug}?season=${item.season ?? 1}&episode=${item.episode ?? 1}`
              : `/watch/${item.slug}?t=${item.timestamp}`

            return (
              <motion.div
                key={item.movieId}
                className="relative flex-shrink-0 w-[280px] sm:w-[320px] group"
                whileHover={{ scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              >
                <Link href={watchHref} className="block">
                  {/* Thumbnail */}
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-card">
                    {(item.backdropUrl || item.posterUrl) ? (
                      <Image
                        src={item.backdropUrl || item.posterUrl}
                        alt={item.title}
                        fill
                        sizes="(max-width: 640px) 280px, 320px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-card" />
                    )}

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    {/* Play Button */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-glow-md">
                        <PlayIcon />
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                      <div 
                        className="h-full bg-primary"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>

                    {/* Time Left Badge */}
                    <div className="absolute top-2 right-2 px-2 py-1 rounded-md bg-background/80 backdrop-blur-sm">
                      <span className="text-xs font-medium text-foreground">
                        {formatTime(timeLeft)} left
                      </span>
                    </div>

                    {/* Remove Button */}
                    {onRemove && (
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          onRemove(item.movieId)
                        }}
                        className="absolute top-2 left-2 p-1.5 rounded-full bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
                        aria-label="Remove from history"
                      >
                        <XIcon />
                      </button>
                    )}
                  </div>

                  {/* Title */}
                  <div className="mt-3 px-1">
                    <h3 className="text-sm font-medium text-foreground line-clamp-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.type === 'tvshow' && item.season && item.episode
                        ? `S${String(item.season).padStart(2,'0')} E${String(item.episode).padStart(2,'0')}`
                        : `${Math.round(progress)}% watched`}
                    </p>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
