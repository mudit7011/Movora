'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Movie } from '@/types/movie'
import { useTV } from '@/components/TvProvider'
import TvNavbar from '@/components/TvNavbar'

// Icons as SVG components for premium look
const HomeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>
)

const FilmIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5" />
  </svg>
)

const TvIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125z" />
  </svg>
)

const GridIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const BookmarkIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
  </svg>
)

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const SearchIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
)

interface NavItem {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}

const FlameIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
  </svg>
)

const LiveTvIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="1"/>
    <path d="M18.4,5.6L17,7.1c1.3,1.3,2,3.1,2,4.9s-0.7,3.6-2.1,5l1.4,1.4c1.7-1.7,2.6-4,2.6-6.4S20.1,7.3,18.4,5.6z"/>
    <path d="M7.1,7L5.6,5.6C3.9,7.3,3,9.6,3,12c0,2.4,0.9,4.7,2.6,6.4L7,16.9c-1.3-1.3-2-3.1-2-4.9S5.7,8.4,7.1,7z"/>
    <path d="M15.5,8.5l-1.4,1.4c0.6,0.6,0.9,1.3,0.9,2.1c0,0.8-0.3,1.5-0.9,2.1l1.4,1.4c1-1,1.5-2.2,1.5-3.5S16.5,9.4,15.5,8.5z"/>
    <path d="M8.5,8.5C7.5,9.4,7,10.6,7,12c0,1.4,0.5,2.6,1.5,3.5l1.4-1.4C9.3,13.5,9,12.8,9,12c0-0.8,0.3-1.5,0.9-2.1L8.5,8.5z"/>
  </svg>
)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SportsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 194 194" fill="none">
    <circle fill="currentColor" fillOpacity="0.15" cx="97" cy="97" r="97"/>
    <circle fill="none" stroke="currentColor" strokeWidth="6" cx="97" cy="97" r="94"/>
    <path fill="currentColor" d="m 94,9.2 a 88,88 0 0 0 -55,21.8 l 27,0 28,-14.4 0,-7.4 z m 6,0 0,7.4 28,14.4 27,0 a 88,88 0 0 0 -55,-21.8 z m -67.2,27.8 a 88,88 0 0 0 -20,34.2 l 16,27.6 23,-3.6 21,-36.2 -8.4,-22 -31.6,0 z m 96.8,0 -8.4,22 21,36.2 23,3.6 15.8,-27.4 a 88,88 0 0 0 -19.8,-34.4 l -31.6,0 z m -50,26 -20.2,35.2 17.8,30.8 39.6,0 17.8,-30.8 -20.2,-35.2 -34.8,0 z m -68.8,16.6 a 88,88 0 0 0 -1.8,17.4 88,88 0 0 0 10.4,41.4 l 7.4,-4.4 -1.4,-29 -14.6,-25.4 z m 172.4,0.2 -14.6,25.2 -1.4,29 7.4,4.4 a 88,88 0 0 0 10.4,-41.4 88,88 0 0 0 -1.8,-17.2 z m -106,57.2 -15.4,19 L 77.2,182.6 a 88,88 0 0 0 19.8,2.4 88,88 0 0 0 19.8,-2.4 l 15.4,-26.6 -15.4,-19 -39.6,0 z m -47.8,2.6 -7,4 A 88,88 0 0 0 68.8,180.4 l -14,-24.6 -25.4,-16.2 z m 135.2,0 -25.4,16.2 -14,24.4 a 88,88 0 0 0 46.4,-36.6 l -7,-4 z"/>
  </svg>
)

const navItems: NavItem[] = [
  { href: '/', icon: HomeIcon, label: 'Home' },
  { href: '/new', icon: FlameIcon, label: 'New & Popular' },
  { href: '/movies', icon: FilmIcon, label: 'Movies' },
  { href: '/shows', icon: TvIcon, label: 'TV Shows' },
  // Live Sports (match embeds) hidden for now — page code kept, access blocked via redirect in next.config.
  // { href: '/sports', icon: SportsIcon, label: 'Live Sports' },
  { href: '/livetv', icon: LiveTvIcon, label: 'Live TV' },
  { href: '/platforms', icon: GridIcon, label: 'Platforms' },
  { href: '/watchlist', icon: BookmarkIcon, label: 'Watch Later' },
  { href: '/history', icon: ClockIcon, label: 'Continue' },
]

// Shorter labels for mobile bottom nav (5 items)
const MOBILE_NAV = [
  { href: '/',        icon: HomeIcon,     label: 'Home'   },
  { href: '/new',     icon: FlameIcon,    label: 'New'    },
  { href: '/movies',  icon: FilmIcon,     label: 'Movies' },
  { href: '/shows',   icon: TvIcon,       label: 'Shows'  },
]

// Sidebar runs only in the browser — use relative URL so the Next.js rewrite
// proxy forwards requests to the backend (avoids mixed-content blocking).
const API_URL = ''

const RECENTS_KEY = 'movora_recent_searches'
const MAX_RECENTS = 6

function getRecents(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]') } catch { return [] }
}
function saveRecent(q: string) {
  const prev = getRecents().filter(s => s.toLowerCase() !== q.toLowerCase())
  localStorage.setItem(RECENTS_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENTS)))
}
function removeRecent(q: string) {
  const prev = getRecents().filter(s => s !== q)
  localStorage.setItem(RECENTS_KEY, JSON.stringify(prev))
}

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

export default function Sidebar() {
  const isTV    = useTV()
  const pathname = usePathname()
  const router = useRouter()
  // Optimistic nav highlight: `pathname` only updates AFTER the destination page's
  // server data finishes loading (backend latency makes this feel slow). Tracking the
  // tapped href lets us highlight the icon instantly, then clear once navigation lands.
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Movie[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const [recents, setRecents] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const mobileItemRefs = useRef<(HTMLElement | null)[]>([])
  const mobileTextRefs = useRef<(HTMLElement | null)[]>([])

  // Load recents on mount (client only)
  useEffect(() => { setRecents(getRecents()) }, [])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setQuery('')
    setResults([])
    setSelectedIdx(-1)
  }, [])

  const navigate = useCallback((item: Movie) => {
    router.push(item.type === 'tvshow' ? `/show/${item.slug}` : `/movie/${item.slug}`)
    closeSearch()
  }, [router, closeSearch])

  const submitQuery = useCallback((q: string) => {
    if (!q.trim()) return
    saveRecent(q.trim())
    setRecents(getRecents())
    router.push(`/search?q=${encodeURIComponent(q.trim())}`)
    closeSearch()
  }, [router, closeSearch])

  // Open on Cmd+K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 50)
  }, [searchOpen])

  // Once the new route lands, drop the optimistic highlight.
  useEffect(() => { setPendingHref(null) }, [pathname])

  // Slide underline to active item's text width
  useEffect(() => {
    const active = pendingHref ?? pathname
    const activeIdx = MOBILE_NAV.findIndex(item => active === item.href)
    for (let i = 0; i <= 4; i++) {
      const itemEl = mobileItemRefs.current[i]
      const textEl = mobileTextRefs.current[i]
      if (!itemEl) continue
      const isActive = i < 4 ? i === activeIdx : searchOpen
      itemEl.style.setProperty('--lineWidth', isActive && textEl ? `${textEl.offsetWidth}px` : '0px')
    }
  }, [pathname, pendingHref, searchOpen])

  // Debounced live search
  useEffect(() => {
    if (!searchOpen || !query.trim()) {
      setResults([])
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    setSelectedIdx(-1)
    const timer = setTimeout(async () => {
      try {
        const q = encodeURIComponent(query.trim())
        const [movies, shows] = await Promise.all([
          fetch(`${API_URL}/api/movies/search?q=${q}`).then(r => r.json()),
          fetch(`${API_URL}/api/shows/search?q=${q}`).then(r => r.json()),
        ])
        const merged: Movie[] = []
        const max = Math.max((movies as Movie[]).length, (shows as Movie[]).length)
        for (let i = 0; i < max && merged.length < 8; i++) {
          if (movies[i] && merged.length < 8) merged.push(movies[i])
          if (shows[i] && merged.length < 8) merged.push(shows[i])
        }
        setResults(merged)
      } catch {
        setResults([])
      }
      setIsSearching(false)
    }, 260)
    return () => clearTimeout(timer)
  }, [query, searchOpen])

  // Keyboard navigation
  useEffect(() => {
    if (!searchOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeSearch(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx(i => Math.min(i + 1, results.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx(i => Math.max(i - 1, -1))
      }
      if (e.key === 'Enter') {
        if (selectedIdx >= 0 && results[selectedIdx]) {
          navigate(results[selectedIdx])
        } else if (query.trim()) {
          submitQuery(query)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [searchOpen, results, selectedIdx, query, navigate, submitQuery, closeSearch])

  if (isTV) return <TvNavbar />

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isExpanded ? 200 : 72 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        className="fixed left-4 top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col rounded-2xl py-4 overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, rgba(6,214,224,0.04) 0%, rgba(10,10,10,0.45) 40%, rgba(10,10,10,0.40) 100%)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(6,214,224,0.08)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.03), 0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 px-5 mb-6">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
            <defs>
              <linearGradient id="sbBg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop stopColor="#131313"/>
                <stop offset="1" stopColor="#0A0A0A"/>
              </linearGradient>
              <linearGradient id="sbMark" x1="7" y1="9" x2="25" y2="23" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1CF5FF"/>
                <stop offset="1" stopColor="#06B6C2"/>
              </linearGradient>
              <radialGradient id="sbGlow" cx="16" cy="16" r="14" gradientUnits="userSpaceOnUse">
                <stop stopColor="#06D6E0" stopOpacity="0.22"/>
                <stop offset="1" stopColor="#06D6E0" stopOpacity="0"/>
              </radialGradient>
            </defs>
            <rect width="32" height="32" rx="7.5" fill="url(#sbBg)"/>
            <ellipse cx="16" cy="16" rx="12" ry="10" fill="url(#sbGlow)"/>
            <rect x="0.5" y="0.5" width="31" height="31" rx="7" stroke="#06D6E0" strokeOpacity="0.3" strokeWidth="0.75"/>
            <path d="M7 23V9l9 8.5L25 9v14" stroke="url(#sbMark)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="16" cy="18.5" r="1.1" fill="#1CF5FF" fillOpacity="0.8"/>
          </svg>
          <AnimatePresence>
            {isExpanded && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="font-semibold text-foreground tracking-wide whitespace-nowrap"
              >
                MOVORA
              </motion.span>
            )}
          </AnimatePresence>
        </Link>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1 px-3">
          {navItems.map((item) => {
            const isActive = (pendingHref ?? pathname) === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                onClick={() => setPendingHref(item.href)}
                className={`group relative flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-full" />
                )}
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <AnimatePresence>
                  {isExpanded && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="text-sm font-medium whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            )
          })}
        </nav>

        {/* Search Button */}
        <div className="mt-auto px-3 pt-4 border-t border-white/5">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-3 px-3 py-3 w-full rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-300"
          >
            <SearchIcon className="w-5 h-5 flex-shrink-0" />
            <AnimatePresence>
              {isExpanded && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="text-sm font-medium whitespace-nowrap"
                >
                  Search
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* Mobile Bottom Navigation — InteractiveMenu style */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden glass-strong border-t border-white/[0.06]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center">
          {MOBILE_NAV.map((item, i) => {
            const isActive = (pendingHref ?? pathname) === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                onClick={() => setPendingHref(item.href)}
                className={`mnav__item ${isActive ? 'mnav--active' : ''}`}
                ref={(el: HTMLAnchorElement | null) => { mobileItemRefs.current[i] = el }}
                style={{ '--lineWidth': '0px' } as React.CSSProperties}
              >
                <div className="mnav__icon">
                  <item.icon className="w-[22px] h-[22px]" />
                </div>
                <strong
                  className="mnav__label"
                  ref={el => { mobileTextRefs.current[i] = el }}
                >
                  {item.label}
                </strong>
              </Link>
            )
          })}
          <button
            onClick={() => setSearchOpen(true)}
            className={`mnav__item ${searchOpen ? 'mnav--active' : ''}`}
            ref={el => { mobileItemRefs.current[4] = el }}
            style={{ '--lineWidth': '0px' } as React.CSSProperties}
          >
            <div className="mnav__icon">
              <SearchIcon className="w-[22px] h-[22px]" />
            </div>
            <strong
              className="mnav__label"
              ref={el => { mobileTextRefs.current[4] = el }}
            >
              Search
            </strong>
          </button>
        </div>
      </nav>

      {/* Premium Search Command Palette */}
      <AnimatePresence>
        {searchOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={closeSearch}
              className="fixed inset-0 z-[60]"
              style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
            />

            <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[8vh] pointer-events-none">
              <motion.div
                initial={{ opacity: 0, y: -16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 440, damping: 40 }}
                className="w-full max-w-[700px] pointer-events-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="relative rounded-2xl"
                  style={{
                    background: 'linear-gradient(160deg, rgba(6,214,224,0.04) 0%, rgba(10,10,10,0.78) 35%, rgba(10,10,10,0.75) 100%)',
                    backdropFilter: 'blur(40px)',
                    WebkitBackdropFilter: 'blur(40px)',
                    border: 'none',
                    boxShadow: '0 0 0 1px rgba(255,255,255,0.02), 0 40px 80px rgba(0,0,0,0.6), 0 0 50px rgba(6,214,224,0.05)',
                  }}
                >
                  <div className="rounded-2xl overflow-hidden">

                    {/* ── Input row ── */}
                    <div className="flex items-center gap-3 px-5 py-4 pb-3.5">
                      <div className="flex-shrink-0">
                        <AnimatePresence mode="wait">
                          {isSearching ? (
                            <motion.svg key="spin" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="w-5 h-5 text-primary animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="55" strokeDashoffset="38" strokeLinecap="round" />
                            </motion.svg>
                          ) : (
                            <motion.div key="icon" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                              <SearchIcon className="w-5 h-5 text-white/25" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <input
                        ref={inputRef}
                        value={query}
                        onChange={e => { setQuery(e.target.value); setSelectedIdx(-1) }}
                        onKeyDown={e => e.key === 'Enter' && !results.length && query.trim() && submitQuery(query)}
                        placeholder="Search movies, shows, actors..."
                        className="flex-1 bg-transparent text-white placeholder:text-white/18 text-[17px] font-medium outline-none tracking-tight"
                        style={{ caretColor: 'rgb(6,214,224)' }}
                      />
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <AnimatePresence>
                          {query && (
                            <motion.button
                              initial={{ opacity: 0, scale: 0.7 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.7 }}
                              onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus() }}
                              className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/40 hover:text-white transition-all text-sm leading-none"
                            >×</motion.button>
                          )}
                        </AnimatePresence>
                        {!query && <kbd className="hidden sm:flex items-center gap-0.5 px-2 py-1 text-[10px] font-semibold text-white/15 bg-white/[0.03] rounded-md border border-white/[0.05]"><span className="text-xs">⌘</span>K</kbd>}
                        <kbd className="flex items-center px-2 py-1 text-[10px] font-semibold text-white/15 bg-white/[0.03] rounded-md border border-white/[0.05]">ESC</kbd>
                      </div>
                    </div>

                    {/* Progress bar while searching */}
                    <div className="h-[1px] mx-0 relative overflow-hidden">
                      <div className="absolute inset-0 bg-white/[0.05]" />
                      {isSearching && (
                        <motion.div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/60 to-cyan-400/60"
                          initial={{ width: '0%' }}
                          animate={{ width: '85%' }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                      )}
                    </div>

                    {/* ── Body ── */}
                    <AnimatePresence mode="wait">
                      {results.length > 0 ? (
                        <motion.div
                          key="results"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.1 }}
                          className="overflow-y-auto overscroll-contain"
                          style={{ maxHeight: 'min(58vh, 500px)' }}
                        >
                          <div className="px-5 pt-3 pb-1 flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-white/15 uppercase tracking-[0.12em]">
                              {results.length} result{results.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {results.map((item, i) => {
                            const isSelected = i === selectedIdx
                            const isShow = item.type === 'tvshow'
                            return (
                              <motion.button
                                key={item._id}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.03, duration: 0.15 }}
                                onClick={() => navigate(item)}
                                onMouseEnter={() => setSelectedIdx(i)}
                                className={`w-full flex items-center gap-4 px-5 py-3 text-left transition-all duration-100 group ${
                                  isSelected ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
                                }`}
                              >
                                {/* Poster — 2:3 ratio, 48×72 */}
                                <div className={`flex-shrink-0 w-12 h-[72px] rounded-lg overflow-hidden bg-white/[0.06] ring-1 transition-all ${isSelected ? 'ring-primary/40 shadow-lg shadow-primary/10' : 'ring-white/[0.07]'}`}>
                                  {item.posterUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={item.posterUrl} alt={item.title}
                                      className="object-cover w-full h-full" loading="lazy" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <svg className="w-4 h-4 text-white/10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z"/></svg>
                                    </div>
                                  )}
                                </div>

                                {/* Text */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-[14.5px] font-semibold text-white/90 line-clamp-1 leading-snug mb-1.5">
                                    {highlightTokens(item.title, query)}
                                  </p>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded tracking-wider ${
                                      isShow ? 'text-primary bg-primary/10 border border-primary/20' : 'text-white/30 bg-white/[0.05] border border-white/[0.08]'
                                    }`}>
                                      {isShow ? 'SERIES' : 'MOVIE'}
                                    </span>
                                    <span className="text-[11px] text-white/30 font-medium">{item.releaseYear}</span>
                                    {item.genres[0] && (
                                      <span className="text-[11px] text-white/20 truncate max-w-[100px]">{item.genres[0]}</span>
                                    )}
                                  </div>
                                </div>

                                {/* Rating + arrow */}
                                <div className="flex-shrink-0 flex flex-col items-end gap-2">
                                  <div className="flex items-center gap-1">
                                    <svg className="w-3 h-3 text-yellow-400/70" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                    </svg>
                                    <span className="text-[12px] font-bold text-white/45">{item.rating.toFixed(1)}</span>
                                  </div>
                                  <motion.svg
                                    className="w-3.5 h-3.5 text-primary/50"
                                    animate={{ opacity: isSelected ? 1 : 0, x: isSelected ? 0 : -4 }}
                                    transition={{ duration: 0.15 }}
                                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                  >
                                    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
                                  </motion.svg>
                                </div>
                              </motion.button>
                            )
                          })}
                        </motion.div>

                      ) : query.trim() && !isSearching ? (
                        <motion.div key="empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="py-16 flex flex-col items-center gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                            <svg className="w-7 h-7 text-white/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                              <path d="M8 11h6M11 8v6" strokeLinecap="round"/>
                            </svg>
                          </div>
                          <div className="text-center">
                            <p className="text-[13px] font-medium text-white/30">No results for</p>
                            <p className="text-[15px] font-bold text-white/55 mt-0.5">&ldquo;{query}&rdquo;</p>
                            <p className="text-[11px] text-white/20 mt-2">Try different keywords or check spelling</p>
                          </div>
                        </motion.div>

                      ) : !query.trim() ? (
                        <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-5 py-4">
                          {/* Recent searches */}
                          {recents.length > 0 && (
                            <div className="mb-4">
                              <div className="flex items-center justify-between mb-2.5">
                                <p className="text-[10px] text-white/15 uppercase tracking-[0.14em] font-semibold">Recent searches</p>
                                <button
                                  onClick={() => { localStorage.setItem(RECENTS_KEY, '[]'); setRecents([]) }}
                                  className="text-[10px] text-white/20 hover:text-white/50 transition-colors"
                                >Clear all</button>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {recents.map(r => (
                                  <div key={r} className="group flex items-center gap-1 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] rounded-full transition-all">
                                    <button
                                      onClick={() => { setQuery(r); inputRef.current?.focus() }}
                                      className="flex items-center gap-1.5 pl-3 pr-1 py-1.5"
                                    >
                                      <svg className="w-3 h-3 text-white/20 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
                                      </svg>
                                      <span className="text-[11px] font-medium text-white/45">{r}</span>
                                    </button>
                                    <button
                                      onClick={() => { removeRecent(r); setRecents(getRecents()) }}
                                      className="pr-2 pl-0.5 py-1.5 text-white/15 hover:text-white/50 transition-colors opacity-0 group-hover:opacity-100 text-xs"
                                    >×</button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Genre chips */}
                          <div className={recents.length > 0 ? 'pt-3 border-t border-white/[0.04]' : ''}>
                            <p className="text-[10px] text-white/15 uppercase tracking-[0.14em] font-semibold mb-2.5">Browse by genre</p>
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                { label: 'Action', href: '/movies?genre=Action' },
                                { label: 'Thriller', href: '/movies?genre=Thriller' },
                                { label: 'Drama', href: '/movies?genre=Drama' },
                                { label: 'Comedy', href: '/movies?genre=Comedy' },
                                { label: 'Sci-Fi', href: '/movies?genre=Sci-Fi' },
                                { label: 'Crime', href: '/movies?genre=Crime' },
                                { label: 'Horror', href: '/movies?genre=Horror' },
                                { label: 'TV Drama', href: '/shows?genre=Drama' },
                                { label: 'TV Action', href: '/shows?genre=Action+%26+Adventure' },
                              ].map(item => (
                                <button
                                  key={item.label}
                                  onClick={() => { router.push(item.href); closeSearch() }}
                                  className="px-3 py-1.5 text-[11px] font-medium text-white/35 bg-white/[0.04] hover:bg-white/[0.08] hover:text-white/65 rounded-full border border-white/[0.06] transition-all"
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Quick access */}
                          <div className="mt-4 pt-3 border-t border-white/[0.04]">
                            <p className="text-[10px] text-white/15 uppercase tracking-[0.14em] font-semibold mb-2">Quick access</p>
                            <div className="flex gap-2">
                              {[
                                { label: 'New & Popular', href: '/new' },
                                { label: 'Top Rated', href: '/movies?sort=rating' },
                                { label: 'Watch Later', href: '/watchlist' },
                              ].map(item => (
                                <button
                                  key={item.label}
                                  onClick={() => { router.push(item.href); closeSearch() }}
                                  className="flex-1 py-2.5 text-[11px] font-medium text-white/35 bg-white/[0.04] hover:bg-white/[0.08] hover:text-white/65 rounded-xl border border-white/[0.06] transition-all"
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>

                    {/* ── Footer ── */}
                    <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/[0.04]">
                      <div className="flex items-center gap-3.5">
                        {[['↑↓', 'navigate'], ['↵', 'select'], ['esc', 'close']].map(([key, label]) => (
                          <div key={key} className="flex items-center gap-1.5">
                            <kbd className="px-1.5 py-0.5 text-[9px] font-bold text-white/18 bg-white/[0.04] rounded border border-white/[0.06]">{key}</kbd>
                            <span className="text-[10px] text-white/12">{label}</span>
                          </div>
                        ))}
                      </div>
                      {query.trim() && (
                        <button
                          onClick={() => submitQuery(query)}
                          className="flex items-center gap-1.5 text-[11px] text-primary/40 hover:text-primary font-semibold transition-colors group"
                        >
                          See all results
                          <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 6h8M6 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
