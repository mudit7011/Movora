'use client'

import { useState, useTransition, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import type { Movie } from '@/types/movie'
import MovieCard from './MovieCard'
import { useTV } from '@/components/TvProvider'

const GENRES = ['Drama', 'Crime', 'Action & Adventure', 'Sci-Fi & Fantasy', 'Comedy', 'Mystery', 'Animation', 'Documentary', 'War & Politics', 'Family', 'Western', 'Kids']
const YEARS = Array.from({ length: 9 }, (_, i) => String(new Date().getFullYear() - i))
const SORTS = [
  { value: 'recent', label: 'Latest' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'year',   label: 'By Year' },
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
  const isTV = useTV()

  const [shows, setShows] = useState<Movie[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const genre    = searchParams.get('genre')    ?? initialGenre    ?? ''
  const year     = searchParams.get('year')     ?? initialYear     ?? ''
  const language = searchParams.get('language') ?? initialLanguage ?? ''
  const sort     = searchParams.get('sort')     ?? initialSort     ?? 'recent'

  const setFilter = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete('page')
    router.push(`/shows?${params}`)
  }, [router, searchParams])

  const toggle = useCallback((key: string, value: string, current: string) => {
    setFilter(key, value === current ? '' : value)
  }, [setFilter])

  const clearFilters = useCallback(() => {
    router.push(`/shows?sort=${sort}`)
  }, [router, sort])

  const hasFilters = !!(genre || year || language)

  useEffect(() => {
    setLoading(true)
    setPage(1)
    api.getShows({ genre, year, language, sort, limit: '20' })
      .then(data => {
        setShows(data.movies)
        setTotal(data.total)
        setPages(data.pages)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [genre, year, language, sort])

  const loadMore = () => {
    const nextPage = page + 1
    startTransition(async () => {
      const data = await api.getShows({ genre, year, language, sort, page: String(nextPage), limit: '20' })
      setShows(prev => {
        const seen = new Set(prev.map(m => String(m._id)))
        const fresh = data.movies.filter(m => !seen.has(String(m._id)))
        return [...prev, ...fresh]
      })
      setPage(nextPage)
    })
  }

  const hasMore = page < pages

  return (
    <div className={`min-h-screen pb-24 lg:pb-8 ${isTV ? 'pt-20' : 'lg:pl-24'}`}>

      {/* Sticky filter bar — same style as movies */}
      <div className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-white/[0.06] pt-[env(safe-area-inset-top)]">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:pl-8 lg:pr-8 py-3">

          {/* Sort + Language + Year */}
          <div className="flex items-center gap-6 mb-3 overflow-x-auto no-scrollbar">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold flex-shrink-0">Sort</span>
            <div className="flex gap-1.5 flex-shrink-0">
              {SORTS.map(s => (
                <button
                  key={s.value}
                  onClick={() => setFilter('sort', s.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    sort === s.value
                      ? 'bg-primary text-background'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="w-px h-4 bg-white/10 flex-shrink-0" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold flex-shrink-0">Language</span>
            <div className="flex gap-1.5 flex-shrink-0">
              {['Hindi', 'English'].map(lang => (
                <button
                  key={lang}
                  onClick={() => toggle('language', lang, language)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    language === lang
                      ? 'bg-primary/20 border border-primary/50 text-primary'
                      : 'border border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>

            <div className="w-px h-4 bg-white/10 flex-shrink-0" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold flex-shrink-0">Year</span>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {YEARS.map(y => (
                <button
                  key={y}
                  onClick={() => toggle('year', y, year)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                    year === y
                      ? 'bg-primary/20 border border-primary/50 text-primary'
                      : 'border border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="ml-auto flex-shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                Clear ×
              </button>
            )}
          </div>

          {/* Genre chips */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setFilter('genre', '')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                !genre
                  ? 'bg-white/10 text-foreground border border-white/20'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All
            </button>
            {GENRES.map(g => (
              <button
                key={g}
                onClick={() => toggle('genre', g, genre)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  genre === g
                    ? 'bg-primary/20 border border-primary/50 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:pl-8 lg:pr-8 pt-8 pb-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              {genre ? `${genre}` : 'Browse'}{' '}
              <span className="text-muted-foreground font-normal">TV Shows</span>
            </h1>
            {total > 0 && (
              <p className="text-sm text-muted-foreground mt-1">{total} shows</p>
            )}
          </div>
          {hasFilters && (
            <div className="flex flex-wrap gap-2">
              {genre && (
                <span className="text-xs bg-primary/10 border border-primary/20 text-primary px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  {genre}
                  <button onClick={() => setFilter('genre', '')} className="hover:text-white transition-colors">×</button>
                </span>
              )}
              {year && (
                <span className="text-xs bg-primary/10 border border-primary/20 text-primary px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  {year}
                  <button onClick={() => setFilter('year', '')} className="hover:text-white transition-colors">×</button>
                </span>
              )}
              {language && (
                <span className="text-xs bg-primary/10 border border-primary/20 text-primary px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  {language}
                  <button onClick={() => setFilter('language', '')} className="hover:text-white transition-colors">×</button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:pl-8 lg:pr-8">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 lg:gap-5">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl shimmer bg-card" />
            ))}
          </div>
        ) : shows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <p className="text-lg font-medium text-foreground">No shows found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-4 btn-primary px-5 py-2 rounded-xl text-sm">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 lg:gap-5">
              {shows.map(show => (
                <MovieCard key={show._id} movie={show} />
              ))}
              {isPending && Array.from({ length: 10 }).map((_, i) => (
                <div key={`sk-${i}`} className="aspect-[2/3] rounded-xl shimmer bg-card" />
              ))}
            </div>

            {hasMore && (
              <div className="flex flex-col items-center mt-14 mb-8">
                <button
                  onClick={loadMore}
                  disabled={isPending}
                  className="group relative px-10 py-3.5 rounded-2xl font-medium text-sm overflow-hidden transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 hover:border-primary/40 bg-white/[0.03] hover:bg-primary/5"
                >
                  <span className="relative text-muted-foreground group-hover:text-primary transition-colors">
                    {isPending ? 'Loading…' : `Load More  ·  ${shows.length} / ${total}`}
                  </span>
                </button>
              </div>
            )}

            {!hasMore && shows.length > 0 && (
              <p className="text-center text-muted-foreground/50 text-sm mt-14 mb-8">
                All {total} shows loaded
              </p>
            )}
          </>
        )}
      </div>

    </div>
  )
}
