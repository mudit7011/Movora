'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SearchIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
)

const MicIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
  </svg>
)

const trendingSearches = [
  'Action Movies',
  'Comedy 2024',
  'Thriller',
  'Romance',
  'Sci-Fi',
  'Horror',
]

const recentGenres = [
  { name: 'Action', icon: '🎬' },
  { name: 'Comedy', icon: '😂' },
  { name: 'Drama', icon: '🎭' },
  { name: 'Horror', icon: '👻' },
  { name: 'Romance', icon: '💕' },
  { name: 'Sci-Fi', icon: '🚀' },
]

export default function SearchInput() {
  const router = useRouter()
  const params = useSearchParams()
  const [value, setValue] = useState(params.get('q') ?? '')
  const [isFocused, setIsFocused] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (value.trim()) {
        router.push(`/search?q=${encodeURIComponent(value.trim())}`)
      } else {
        router.push('/search')
      }
      setIsTyping(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [value, router])

  const handleSuggestionClick = (suggestion: string) => {
    setValue(suggestion)
    inputRef.current?.focus()
  }

  const showSuggestions = isFocused && !value.trim()

  return (
    <div className="relative max-w-3xl mx-auto">
      {/* Main Search Container */}
      <motion.div 
        className="relative"
        initial={false}
        animate={{
          scale: isFocused ? 1.02 : 1,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Glow Effect */}
        <div className={`absolute -inset-1 bg-gradient-to-r from-primary/50 via-cyan-500/50 to-primary/50 rounded-2xl blur-xl transition-opacity duration-500 ${isFocused ? 'opacity-60' : 'opacity-0'}`} />
        
        {/* Search Box */}
        <div className={`relative bg-card/80 backdrop-blur-xl border-2 rounded-2xl transition-all duration-300 ${isFocused ? 'border-primary shadow-2xl shadow-primary/20' : 'border-white/10'}`}>
          {/* Search Icon with Animation */}
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground">
            <motion.div
              animate={{
                scale: isTyping ? [1, 1.2, 1] : 1,
                rotate: isTyping ? [0, -10, 10, 0] : 0,
              }}
              transition={{ duration: 0.3 }}
            >
              <SearchIcon />
            </motion.div>
          </div>
          
          <input
            ref={inputRef}
            autoFocus
            value={value}
            onChange={e => {
              setValue(e.target.value)
              setIsTyping(true)
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder="Search movies, genres, actors..."
            className="w-full bg-transparent text-foreground placeholder-muted-foreground rounded-2xl pl-14 pr-24 py-5 text-lg outline-none"
          />
          
          {/* Right Side Actions */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {value && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setValue('')}
                className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </motion.button>
            )}
            <button className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors">
              <MicIcon />
            </button>
            <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground bg-white/5 rounded-lg border border-white/10">
              <span>ESC</span>
            </kbd>
          </div>
        </div>
      </motion.div>

      {/* Suggestions Dropdown */}
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 right-0 mt-4 z-50"
          >
            <div className="bg-card/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              {/* Trending Searches */}
              <div className="mb-6">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                  <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                  Trending Searches
                </div>
                <div className="flex flex-wrap gap-2">
                  {trendingSearches.map((search, i) => (
                    <motion.button
                      key={search}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => handleSuggestionClick(search)}
                      className="px-4 py-2 bg-white/5 hover:bg-primary/20 hover:text-primary border border-white/10 hover:border-primary/50 rounded-full text-sm text-foreground transition-all duration-200"
                    >
                      {search}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Browse by Genre */}
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                  <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                  </svg>
                  Browse by Genre
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {recentGenres.map((genre, i) => (
                    <motion.button
                      key={genre.name}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      onClick={() => handleSuggestionClick(genre.name)}
                      className="flex flex-col items-center gap-2 p-3 bg-white/5 hover:bg-primary/20 border border-white/10 hover:border-primary/50 rounded-xl transition-all duration-200 group"
                    >
                      <span className="text-2xl group-hover:scale-110 transition-transform">{genre.icon}</span>
                      <span className="text-xs text-muted-foreground group-hover:text-primary">{genre.name}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
