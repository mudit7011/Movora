'use client'

import { useState, useTransition, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import type { Movie } from '@/types/movie'
import MovieCard from './MovieCard'

const GENRES = ['Drama', 'Crime', 'Action & Adventure', 'Sci-Fi & Fantasy', 'Comedy', 'Mystery', 'Animation', 'Documentary', 'War & Politics', 'Family', 'Western', 'Kids']
const YEARS = ['2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017']
const SORTS = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'year', label: 'By Year' },
]

interface Props {
  initialGenre?: string
  initialYear?: string
  initialLanguage?: string
  initialSort?: string
}

export default function ShowsClient({ initialGenre, initialYear, initialLanguage, initialSort }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [shows, setShows] = useState<Movie[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const genre = searchParams.get('genre') ?? initialGenre ?? ''
  const year = searchParams.get('year') ?? initialYear ?? ''
  const language = searchParams.get('language') ?? initialLanguage ?? ''
  const sort = searchParams.get('sort') ?? initialSort ?? 'recent'

  const setFilter = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`/shows?${params}`)
  }, [router, searchParams])

  const toggle = useCallback((key: string, value: string, current: string) => {
    setFilter(key, current === value ? '' : value)
  }, [setFilter])

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams()
    if (sort !== 'recent') params.set('sort', sort)
    router.push(`/shows?${params}`)
  }, [router, sort])

  const activeFilterCount = [genre, year, language].filter(Boolean).length

  useEffect(() => {
    setLoading(true)
    setPage(1)
    api.getShows({ genre, year, language, sort, limit: '20' })
      .then(data => {
        setShows(data.movies)
        setTotal(data.total)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [genre, year, language, sort])

  const loadMore = () => {
    const nextPage = page + 1
    startTransition(async () => {
      const data = await api.getShows({ genre, year, language, sort, page: String(nextPage), limit: '20' })
      setShows(prev => [...prev, ...data.movies])
      setPage(nextPage)
    })
  }

  const hasMore = shows.length < total

  return (
    <div className="min-h-screen pb-24 lg:pb-8 lg:pl-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-white/[0.06]">
        <div className="px-4 sm:px-6 lg:px-8 pt-5 pb-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">TV Shows</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{total > 0 ? `${total} shows` : 'Browse all shows'}</p>
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Clear filters
                <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              </button>
            )}
          </div>

          {/* Sort tabs */}
          <div className="flex items-center gap-1 mb-3 overflow-x-auto no-scrollbar">
            {SORTS.map(s => (
              <button
                key={s.value}
                onClick={() => setFilter('sort', s.value)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  sort === s.value
                    ? 'bg-primary text-background'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
              >
                {s.label}
              </button>
            ))}

            <div className="w-px h-4 bg-white/10 mx-1 flex-shrink-0" />

            {/* Language chips */}
            {['Hindi', 'English'].map(lang => (
              <button
                key={lang}
                onClick={() => toggle('language', lang, language)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  language === lang
                    ? 'bg-primary/20 text-primary border border-primary/40'
                    : 'text-muted-foreground hover:text-foreground bg-white/[0.04] border border-white/10 hover:border-white/20'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>

          {/* Genre chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {GENRES.map(g => (
              <button
                key={g}
                onClick={() => toggle('genre', g, genre)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  genre === g
                    ? 'bg-primary/20 text-primary border border-primary/40'
                    : 'text-muted-foreground hover:text-foreground bg-white/[0.04] border border-white/10 hover:border-white/20'
                }`}
              >
                {g}
              </button>
            ))}

            <div className="w-px h-4 bg-white/10 mx-1 flex-shrink-0" />

            {/* Year chips */}
            {YEARS.map(y => (
              <button
                key={y}
                onClick={() => toggle('year', y, year)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  year === y
                    ? 'bg-primary/20 text-primary border border-primary/40'
                    : 'text-muted-foreground hover:text-foreground bg-white/[0.04] border border-white/10 hover:border-white/20'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active filter pills */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-4 sm:px-6 lg:px-8 py-3">
          {genre && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
              {genre}
              <button onClick={() => setFilter('genre', '')} className="hover:text-white transition-colors">×</button>
            </span>
          )}
          {year && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
              {year}
              <button onClick={() => setFilter('year', '')} className="hover:text-white transition-colors">×</button>
            </span>
          )}
          {language && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
              {language}
              <button onClick={() => setFilter('language', '')} className="hover:text-white transition-colors">×</button>
            </span>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 lg:gap-5">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[2/3] rounded-xl bg-card" />
                <div className="mt-2 h-3 bg-card rounded w-3/4" />
                <div className="mt-1 h-2 bg-card rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : shows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <p className="text-muted-foreground font-medium">No shows found</p>
            <p className="text-muted-foreground/60 text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 lg:gap-5">
              {shows.map(show => (
                <MovieCard key={show._id} movie={show} />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={loadMore}
                  disabled={isPending}
                  className="btn-glass px-8 py-3 rounded-xl text-sm font-medium disabled:opacity-50"
                >
                  {isPending ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
