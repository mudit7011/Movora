'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import MovieCard from '@/components/MovieCard'
import { api } from '@/lib/api'
import { useUserData } from '@/lib/useUserData'
import type { Movie } from '@/types/movie'

function CategoryContent() {
  const searchParams  = useSearchParams()
  const type          = searchParams.get('type') as 'movies' | 'shows' ?? 'movies'
  const cat           = searchParams.get('cat') ?? 'trending'
  const title         = searchParams.get('title') ?? 'Browse'

  const { addToWatchlist } = useUserData()

  const [items, setItems]           = useState<Movie[]>([])
  const [page, setPage]             = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading]       = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]           = useState('')

  const fetchPage = useCallback(async (p: number, replace = false) => {
    if (replace) setLoading(true)
    else setLoadingMore(true)
    setError('')
    try {
      const data = type === 'movies'
        ? await api.getRealtimeMovies(cat, p)
        : await api.getRealtimeShows(cat, p)
      setItems(prev => replace ? data.results : [...prev, ...data.results])
      setPage(data.page)
      setTotalPages(data.totalPages)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [type, cat])

  useEffect(() => {
    setItems([])
    setPage(1)
    setTotalPages(1)
    fetchPage(1, true)
  }, [fetchPage])

  return (
    <div className="min-h-screen pb-24 lg:pb-8 pt-6 px-4 sm:px-6 lg:pl-28 lg:pr-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {!loading && (
          <p className="text-sm text-muted-foreground mt-1">
            {items.length} {type === 'movies' ? 'movies' : 'shows'} loaded
            {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ''}
          </p>
        )}
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
            {items.map(item => (
              <MovieCard
                key={item._id}
                movie={item}
                onAddToWatchlist={addToWatchlist}
              />
            ))}
          </div>

          {page < totalPages && (
            <div className="flex justify-center mt-10">
              <button
                onClick={() => fetchPage(page + 1)}
                disabled={loadingMore}
                className="flex items-center gap-2 px-6 py-3 bg-primary/10 border border-primary/20 text-primary font-semibold text-sm rounded-xl hover:bg-primary/20 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </>
                ) : (
                  `Load More · Page ${page + 1} of ${totalPages}`
                )}
              </button>
            </div>
          )}

          {page >= totalPages && items.length > 0 && (
            <p className="text-center text-xs text-muted-foreground/50 mt-10">
              All {items.length} titles loaded
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default function CategoryPage() {
  return (
    <>
      <Sidebar />
      <Suspense fallback={<div className="min-h-screen" />}>
        <CategoryContent />
      </Suspense>
    </>
  )
}
