'use client'

import { useState, useTransition } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import MovieCard from './MovieCard'
import type { Movie } from '@/types/movie'

const API_URL = ''

const GENRES = ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller']
const YEARS  = Array.from({ length: 9 }, (_, i) => String(new Date().getFullYear() - i))
const SORTS  = [
  { value: 'recent', label: 'Latest' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'year',   label: 'By Year' },
]

interface Props {
  initialMovies: Movie[]
  initialTotal:  number
  initialPages:  number
}

export default function BrowseClient({ initialMovies, initialTotal, initialPages }: Props) {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const [movies, setMovies] = useState<Movie[]>(initialMovies)
  const [page, setPage]     = useState(1)
  const [isPending, start]  = useTransition()

  const total = initialTotal
  const pages = initialPages

  const activeGenre    = searchParams.get('genre')    ?? ''
  const activeYear     = searchParams.get('year')     ?? ''
  const activeSort     = searchParams.get('sort')     ?? 'recent'
  const activeLanguage = searchParams.get('language') ?? ''
  const hasMore = page < pages
  const hasFilters = !!(activeGenre || activeYear || (activeLanguage && activeLanguage !== ''))

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    router.push(`/movies?${next}`)
  }

  function toggle(key: string, value: string, current: string) {
    setFilter(key, value === current ? '' : value)
  }

  function clearFilters() {
    router.push(`/movies?sort=${activeSort}`)
  }

  function loadMore() {
    const nextPage = page + 1
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(nextPage))
    params.set('limit', '20')

    start(async () => {
      const res = await fetch(`${API_URL}/api/movies?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setMovies(prev => [...prev, ...data.movies])
      setPage(nextPage)
    })
  }

  return (
    <div>

      {/* ── Sticky filter bar ── */}
      <div className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:pl-8 lg:pr-8 py-3">

          {/* Sort tabs */}
          <div className="flex items-center gap-6 mb-3 overflow-x-auto no-scrollbar">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold flex-shrink-0">Sort</span>
            <div className="flex gap-1.5 flex-shrink-0">
              {SORTS.map(s => (
                <button
                  key={s.value}
                  onClick={() => setFilter('sort', s.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    activeSort === s.value
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
                  onClick={() => toggle('language', lang, activeLanguage)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    activeLanguage === lang
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
                  onClick={() => toggle('year', y, activeYear)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                    activeYear === y
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
                !activeGenre
                  ? 'bg-white/10 text-foreground border border-white/20'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All
            </button>
            {GENRES.map(g => (
              <button
                key={g}
                onClick={() => toggle('genre', g, activeGenre)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  activeGenre === g
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

      {/* ── Header ── */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:pl-8 lg:pr-8 pt-8 pb-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              {activeGenre ? `${activeGenre}` : 'Browse'}{' '}
              <span className="text-muted-foreground font-normal">Movies</span>
            </h1>
            {total > 0 && (
              <p className="text-sm text-muted-foreground mt-1">{total} titles</p>
            )}
          </div>
          {hasFilters && (
            <div className="flex flex-wrap gap-2">
              {activeGenre && (
                <span className="text-xs bg-primary/10 border border-primary/20 text-primary px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  {activeGenre}
                  <button onClick={() => setFilter('genre', '')} className="hover:text-white transition-colors">×</button>
                </span>
              )}
              {activeYear && (
                <span className="text-xs bg-primary/10 border border-primary/20 text-primary px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  {activeYear}
                  <button onClick={() => setFilter('year', '')} className="hover:text-white transition-colors">×</button>
                </span>
              )}
              {activeLanguage && (
                <span className="text-xs bg-primary/10 border border-primary/20 text-primary px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  {activeLanguage}
                  <button onClick={() => setFilter('language', '')} className="hover:text-white transition-colors">×</button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:pl-8 lg:pr-8">
        {movies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <p className="text-lg font-medium text-foreground">No movies found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="mt-4 btn-primary px-5 py-2 rounded-xl text-sm"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 lg:gap-5">
              {movies.map(movie => (
                <MovieCard key={movie._id} movie={movie} />
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
                    {isPending ? 'Loading…' : `Load More  ·  ${movies.length} / ${total}`}
                  </span>
                </button>
              </div>
            )}

            {!hasMore && movies.length > 0 && (
              <p className="text-center text-muted-foreground/50 text-sm mt-14 mb-8">
                All {total} movies loaded
              </p>
            )}
          </>
        )}
      </div>

    </div>
  )
}
