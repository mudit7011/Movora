'use client'

import { useRef, useState, useEffect } from 'react'
import { motion, useMotionValue, useSpring, PanInfo } from 'framer-motion'
import type { Movie } from '@/types/movie'
import MovieCard from './MovieCard'

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
  onAddToWatchlist?: (movie: Movie) => void
}

export default function Carousel({ title, movies, onAddToWatchlist }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [constraints, setConstraints] = useState({ left: 0, right: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(true)

  const x = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 300, damping: 30 })

  // Calculate drag constraints
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
  }, [movies])

  // Update arrow visibility based on scroll position
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

  const handleDragStart = () => setIsDragging(true)
  
  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false)
    
    // Snap to nearest card
    const velocity = info.velocity.x
    const currentX = x.get()
    
    // Add momentum
    const momentum = velocity * 0.2
    const targetX = Math.max(
      constraints.left,
      Math.min(0, currentX + momentum)
    )
    
    x.set(targetX)
  }

  if (movies.length === 0) return null

  return (
    <section className="py-8 relative group/carousel">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-4 sm:px-6 lg:pl-24 lg:pr-8">
        <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
          {title}
        </h2>
        
        {/* Navigation Arrows - Desktop */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => scroll('left')}
            disabled={!showLeftArrow}
            className={`p-2 rounded-full bg-white/5 border border-white/10 text-foreground transition-all duration-300 ${
              showLeftArrow 
                ? 'hover:bg-white/10 hover:border-white/20' 
                : 'opacity-30 cursor-not-allowed'
            }`}
            aria-label="Scroll left"
          >
            <ChevronLeftIcon />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!showRightArrow}
            className={`p-2 rounded-full bg-white/5 border border-white/10 text-foreground transition-all duration-300 ${
              showRightArrow 
                ? 'hover:bg-white/10 hover:border-white/20' 
                : 'opacity-30 cursor-not-allowed'
            }`}
            aria-label="Scroll right"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      {/* Carousel Container */}
      <div className="relative overflow-hidden">
        {/* Left Gradient Fade */}
        <div 
          className={`absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none transition-opacity duration-300 ${
            showLeftArrow ? 'opacity-100' : 'opacity-0'
          }`}
        />
        
        {/* Right Gradient Fade */}
        <div 
          className={`absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none transition-opacity duration-300 ${
            showRightArrow ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Movies Track */}
        <motion.div
          ref={containerRef}
          style={{ x: springX }}
          drag="x"
          dragConstraints={constraints}
          dragElastic={0.1}
          dragTransition={{ bounceStiffness: 300, bounceDamping: 30 }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          className={`flex gap-4 px-4 sm:px-6 lg:pl-24 lg:pr-8 pb-4 ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          {movies.map((movie) => (
            <MovieCard 
              key={movie._id} 
              movie={movie} 
              onAddToWatchlist={onAddToWatchlist}
            />
          ))}
        </motion.div>
      </div>

      {/* Mobile Navigation Hint */}
      <div className="sm:hidden flex justify-center mt-4">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>Swipe to explore</span>
          <motion.span
            animate={{ x: [0, 4, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            →
          </motion.span>
        </div>
      </div>
    </section>
  )
}
