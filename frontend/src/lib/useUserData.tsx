'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import type { Movie } from '@/types/movie'

// Types for stored data
interface WatchProgress {
  movieId: string
  slug: string
  title: string
  posterUrl: string
  backdropUrl?: string
  type: 'movie' | 'tvshow'
  timestamp: number
  duration: number
  lastWatched: number
  season?: number
  episode?: number
}

interface WatchlistItem {
  movieId: string
  slug: string
  title: string
  posterUrl: string
  type: 'movie' | 'tvshow'
  addedAt: number
}

interface UserDataContextType {
  watchlist: WatchlistItem[]
  continueWatching: WatchProgress[]
  addToWatchlist: (movie: Movie) => void
  removeFromWatchlist: (movieId: string) => void
  isInWatchlist: (movieId: string) => boolean
  updateProgress: (movie: Movie, timestamp: number, duration: number, season?: number, episode?: number, nextSeason?: number, nextEpisode?: number) => void
  removeFromHistory: (movieId: string) => void
  isCompleted: (movieId: string) => boolean
  clearAllData: () => void
}

const UserDataContext = createContext<UserDataContextType | undefined>(undefined)

const WATCHLIST_KEY = 'movora_watchlist'
const PROGRESS_KEY = 'movora_progress'
const COMPLETED_KEY = 'movora_completed'

export function UserDataProvider({ children }: { children: ReactNode }) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [continueWatching, setContinueWatching] = useState<WatchProgress[]>([])
  // IDs of titles the user has finished — kept even after they leave Continue Watching,
  // so detail pages can show "Watch Again".
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [isHydrated, setIsHydrated] = useState(false)

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const storedWatchlist = localStorage.getItem(WATCHLIST_KEY)
      const storedProgress = localStorage.getItem(PROGRESS_KEY)
      const storedCompleted = localStorage.getItem(COMPLETED_KEY)

      if (storedWatchlist) {
        setWatchlist(JSON.parse(storedWatchlist))
      }
      if (storedProgress) {
        const progress: WatchProgress[] = JSON.parse(storedProgress)
        // Filter out already-completed items on load so stale localStorage entries disappear
        const active = progress.filter(p => !(p.duration > 0 && p.timestamp / p.duration >= 0.85))
        setContinueWatching(active.sort((a, b) => b.lastWatched - a.lastWatched))
      }
      if (storedCompleted) {
        setCompletedIds(JSON.parse(storedCompleted))
      }
    } catch (error) {
      console.error('Failed to load user data:', error)
    }
    setIsHydrated(true)
  }, [])

  // Persist watchlist to localStorage
  useEffect(() => {
    if (!isHydrated) return
    try {
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist))
    } catch (error) {
      console.error('Failed to save watchlist:', error)
    }
  }, [watchlist, isHydrated])

  // Persist progress to localStorage
  useEffect(() => {
    if (!isHydrated) return
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(continueWatching))
    } catch (error) {
      console.error('Failed to save progress:', error)
    }
  }, [continueWatching, isHydrated])

  // Persist completed IDs to localStorage
  useEffect(() => {
    if (!isHydrated) return
    try {
      localStorage.setItem(COMPLETED_KEY, JSON.stringify(completedIds))
    } catch (error) {
      console.error('Failed to save completed list:', error)
    }
  }, [completedIds, isHydrated])

  const addToWatchlist = useCallback((movie: Movie) => {
    setWatchlist((prev) => {
      if (prev.some((item) => item.movieId === movie._id)) return prev
      return [
        {
          movieId: movie._id,
          slug: movie.slug,
          title: movie.title,
          posterUrl: movie.posterUrl,
          type: (movie.type ?? 'movie') as 'movie' | 'tvshow',
          addedAt: Date.now(),
        },
        ...prev,
      ]
    })
  }, [])

  const removeFromWatchlist = useCallback((movieId: string) => {
    setWatchlist((prev) => prev.filter((item) => item.movieId !== movieId))
  }, [])

  const isInWatchlist = useCallback((movieId: string) => {
    return watchlist.some((item) => item.movieId === movieId)
  }, [watchlist])

  const updateProgress = useCallback((
    movie: Movie,
    timestamp: number,
    duration: number,
    season?: number,
    episode?: number,
    nextSeason?: number,
    nextEpisode?: number,
  ) => {
    const isMovie = !movie.type || movie.type === 'movie'
    const completed = duration > 0 && timestamp / duration >= 0.85

    if (completed) {
      if (isMovie) {
        // Movie finished — drop from continue watching, but remember it as completed
        setContinueWatching(prev => prev.filter(item => item.movieId !== movie._id))
        setCompletedIds(prev => prev.includes(movie._id) ? prev : [...prev, movie._id])
        return
      }
      if (nextSeason !== undefined && nextEpisode !== undefined) {
        // Advance to next episode, reset position to start
        season = nextSeason
        episode = nextEpisode
        timestamp = 0
      } else {
        // Last episode of series — drop from continue watching, mark completed
        setContinueWatching(prev => prev.filter(item => item.movieId !== movie._id))
        setCompletedIds(prev => prev.includes(movie._id) ? prev : [...prev, movie._id])
        return
      }
    }

    setContinueWatching((prev) => {
      const existingIndex = prev.findIndex((item) => item.movieId === movie._id)
      const newProgress: WatchProgress = {
        movieId: movie._id,
        slug: movie.slug,
        title: movie.title,
        posterUrl: movie.posterUrl,
        backdropUrl: movie.backdropUrl,
        type: (movie.type ?? 'movie') as 'movie' | 'tvshow',
        timestamp,
        duration,
        lastWatched: Date.now(),
        season,
        episode,
      }

      let updated: WatchProgress[]
      if (existingIndex >= 0) {
        updated = [...prev]
        updated[existingIndex] = newProgress
      } else {
        updated = [newProgress, ...prev]
      }

      return updated.slice(0, 20).sort((a, b) => b.lastWatched - a.lastWatched)
    })
  }, [])

  const removeFromHistory = useCallback((movieId: string) => {
    setContinueWatching((prev) => prev.filter((item) => item.movieId !== movieId))
  }, [])

  const isCompleted = useCallback((movieId: string) => {
    return completedIds.includes(movieId)
  }, [completedIds])

  const clearAllData = useCallback(() => {
    setWatchlist([])
    setContinueWatching([])
    setCompletedIds([])
    localStorage.removeItem(WATCHLIST_KEY)
    localStorage.removeItem(PROGRESS_KEY)
    localStorage.removeItem(COMPLETED_KEY)
  }, [])

  return (
    <UserDataContext.Provider
      value={{
        watchlist,
        continueWatching,
        addToWatchlist,
        removeFromWatchlist,
        isInWatchlist,
        updateProgress,
        removeFromHistory,
        isCompleted,
        clearAllData,
      }}
    >
      {children}
    </UserDataContext.Provider>
  )
}

export function useUserData() {
  const context = useContext(UserDataContext)
  if (!context) {
    throw new Error('useUserData must be used within a UserDataProvider')
  }
  return context
}
