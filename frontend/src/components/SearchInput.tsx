'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Movie } from '@/types/movie'

function highlightTokens(text: string, query: string): React.ReactNode {
  const tokens = query.trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return text
  const pattern = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const parts = text.split(new RegExp(`(${pattern})`, 'gi'))
  const matchRe = new RegExp(`^(${pattern})$`, 'i')
  return (
    <>
      {parts.map((part, i) =>
        matchRe.test(part)
          ? <mark key={i} className="bg-primary/20 text-primary not-italic rounded-[2px] px-[1px]">{part}</mark>
          : part
      )}
    </>
  )
}

export default function SearchInput() {
  const router = useRouter()
  const params = useSearchParams()
  const [value, setValue] = useState(params.get('q') ?? '')
  const [suggestions, setSuggestions] = useState<Movie[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [micError, setMicError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Live suggestions while typing
  useEffect(() => {
    const q = value.trim()
    if (!q) {
      setSuggestions([])
      setLoading(false)
      return
    }
    setLoading(true)
    setSelectedIdx(-1)
    const timer = setTimeout(async () => {
      try {
        const encoded = encodeURIComponent(q)
        const [movies, shows] = await Promise.all([
          fetch(`/api/movies/search?q=${encoded}`).then(r => r.json()),
          fetch(`/api/shows/search?q=${encoded}`).then(r => r.json()),
        ])
        const seen = new Set<string>()
        const key = (m: Movie) => m.tmdbId || m._id
        const merged: Movie[] = []
        const max = Math.max((movies as Movie[]).length, (shows as Movie[]).length)
        for (let i = 0; i < max && merged.length < 6; i++) {
          if (movies[i] && !seen.has(key(movies[i])) && merged.length < 6) { seen.add(key(movies[i])); merged.push(movies[i]) }
          if (shows[i]  && !seen.has(key(shows[i]))  && merged.length < 6) { seen.add(key(shows[i]));  merged.push(shows[i])  }
        }
        setSuggestions(merged)
      } catch {
        setSuggestions([])
      }
      setLoading(false)
    }, 260)
    return () => clearTimeout(timer)
  }, [value])

  // Navigate to full search results when user stops typing
  useEffect(() => {
    if (!value.trim()) {
      router.push('/search')
      return
    }
    const timer = setTimeout(() => {
      router.push(`/search?q=${encodeURIComponent(value.trim())}`)
    }, 600)
    return () => clearTimeout(timer)
  }, [value, router])

  // Keyboard nav
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!dropdownOpen) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      if (selectedIdx >= 0 && suggestions[selectedIdx]) {
        const item = suggestions[selectedIdx]
        router.push(item.type === 'tvshow' ? `/show/${item.slug}` : `/movie/${item.slug}`)
        setDropdownOpen(false)
      }
    } else if (e.key === 'Escape') {
      setDropdownOpen(false)
      inputRef.current?.blur()
    }
  }, [dropdownOpen, suggestions, selectedIdx, router])

  const startVoiceSearch = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setMicError('Use Chrome for voice search'); setTimeout(() => setMicError(''), 3000); return }
    if (isListening) return
    try {
      const r = new SR()
      r.lang = 'en-IN'; r.interimResults = false; r.maxAlternatives = 1
      r.onstart = () => { setIsListening(true); setMicError('') }
      r.onend   = () => setIsListening(false)
      r.onerror = (e: any) => {
        setIsListening(false)
        const msg = e.error === 'not-allowed' ? 'Mic permission denied'
          : e.error === 'network' ? 'Use Chrome — Brave blocks voice search'
          : 'Voice search failed — try Chrome'
        setMicError(msg); setTimeout(() => setMicError(''), 4000)
      }
      r.onresult = (e: any) => { setValue(e.results[0][0].transcript); inputRef.current?.focus() }
      r.start()
    } catch { setIsListening(false) }
  }

  const showDropdown = dropdownOpen && value.trim().length > 0

  return (
    <div className="relative max-w-3xl mx-auto" ref={containerRef}>
      {/* Ambient glow */}
      <div className={`absolute -inset-4 bg-gradient-to-r from-primary/20 via-cyan-500/15 to-primary/20 rounded-3xl blur-2xl transition-opacity duration-500 pointer-events-none ${dropdownOpen ? 'opacity-100' : 'opacity-0'}`} />

      {/* Search box */}
      <motion.div
        animate={{ scale: dropdownOpen ? 1.01 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative"
      >
        <div className="relative rounded-2xl transition-all duration-300 ring-1 ring-white/[0.06]"
          style={{ background: 'rgba(14,14,20,0.92)', backdropFilter: 'blur(40px)' }}
        >
          {/* Input row */}
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex-shrink-0">
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.svg key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-5 h-5 text-primary animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="55" strokeDashoffset="38" strokeLinecap="round" />
                  </motion.svg>
                ) : (
                  <motion.svg key="icon" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`w-5 h-5 transition-colors ${dropdownOpen ? 'text-primary/70' : 'text-white/25'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                  </motion.svg>
                )}
              </AnimatePresence>
            </div>

            <input
              ref={inputRef}
              autoFocus
              value={value}
              onChange={e => setValue(e.target.value)}
              onFocus={() => setDropdownOpen(true)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
              onKeyDown={onKeyDown}
              placeholder="Search movies, shows, actors..."
              className="flex-1 bg-transparent text-white placeholder:text-white/20 text-[17px] font-medium outline-none tracking-tight"
              style={{ caretColor: 'rgb(6,214,224)' }}
            />

            <div className="flex items-center gap-2 flex-shrink-0">
              <AnimatePresence>
                {value && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    onClick={() => { setValue(''); setSuggestions([]); inputRef.current?.focus() }}
                    className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/40 hover:text-white transition-all text-sm"
                  >×</motion.button>
                )}
              </AnimatePresence>

              {/* Voice search */}
              <div className="relative">
                <button
                  onClick={startVoiceSearch}
                  className={`p-2 rounded-lg transition-all ${isListening ? 'text-red-400 bg-red-400/10 animate-pulse' : 'text-white/25 hover:text-primary hover:bg-primary/10'}`}
                  title="Voice search"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" strokeLinecap="round"/>
                  </svg>
                </button>
                {micError && (
                  <div className="absolute right-0 top-10 whitespace-nowrap text-xs bg-black/90 text-red-400 border border-red-400/20 px-3 py-1.5 rounded-lg z-50">{micError}</div>
                )}
              </div>

              <kbd className="hidden sm:flex items-center px-2 py-1 text-[10px] font-semibold text-white/15 bg-white/[0.03] rounded-md border border-white/[0.05]">ESC</kbd>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-[1px] relative overflow-hidden">
            <div className="absolute inset-0 bg-white/[0.04]" />
            {loading && (
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/50 to-cyan-400/50"
                initial={{ width: '0%' }}
                animate={{ width: '80%' }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            )}
          </div>

          {/* Live suggestions dropdown */}
          <AnimatePresence>
            {showDropdown && suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="overflow-hidden"
              >
                <div className="px-4 pt-2 pb-1">
                  <span className="text-[10px] font-semibold text-white/15 uppercase tracking-[0.12em]">
                    {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {suggestions.map((item, i) => {
                  const isSelected = i === selectedIdx
                  const isShow = item.type === 'tvshow'
                  return (
                    <motion.button
                      key={item._id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.025 }}
                      onMouseDown={() => {
                        router.push(isShow ? `/show/${item.slug}` : `/movie/${item.slug}`)
                      }}
                      onMouseEnter={() => setSelectedIdx(i)}
                      className={`w-full flex items-center gap-4 px-5 py-3 text-left transition-all duration-75 ${
                        isSelected ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      {/* Poster */}
                      <div className={`flex-shrink-0 w-10 h-[60px] rounded-lg overflow-hidden bg-white/[0.06] ring-1 transition-all ${isSelected ? 'ring-primary/40' : 'ring-white/[0.07]'}`}>
                        {item.posterUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.posterUrl} alt={item.title} className="object-cover w-full h-full" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white/10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z"/></svg>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-white/90 line-clamp-1 mb-1">
                          {highlightTokens(item.title, value)}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider ${
                            isShow ? 'text-primary bg-primary/10 border border-primary/20' : 'text-white/30 bg-white/[0.05] border border-white/[0.08]'
                          }`}>
                            {isShow ? 'SERIES' : 'MOVIE'}
                          </span>
                          <span className="text-[11px] text-white/30">{item.releaseYear}</span>
                          {item.genres[0] && <span className="text-[11px] text-white/20 truncate max-w-[120px]">{item.genres[0]}</span>}
                        </div>
                      </div>

                      {/* Rating */}
                      <div className="flex-shrink-0 flex items-center gap-1">
                        <svg className="w-3 h-3 text-yellow-400/60" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        <span className="text-[11px] font-semibold text-white/40">{item.rating.toFixed(1)}</span>
                      </div>
                    </motion.button>
                  )
                })}

                {/* See all results */}
                <div className="px-5 py-3 border-t border-white/[0.05]">
                  <button
                    onMouseDown={() => router.push(`/search?q=${encodeURIComponent(value.trim())}`)}
                    className="flex items-center gap-1.5 text-[12px] font-semibold text-primary/50 hover:text-primary transition-colors group w-full"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
                    </svg>
                    See all results for &ldquo;{value}&rdquo;
                    <svg className="w-3 h-3 ml-auto group-hover:translate-x-0.5 transition-transform" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 6h8M6 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
              </motion.div>
            )}

            {/* No results state */}
            {showDropdown && !loading && value.trim() && suggestions.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-5 py-8 flex flex-col items-center gap-3"
              >
                <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                  <svg className="w-5 h-5 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
                  </svg>
                </div>
                <p className="text-[12px] text-white/30 text-center">
                  No suggestions for <span className="text-white/50 font-semibold">&ldquo;{value}&rdquo;</span>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
