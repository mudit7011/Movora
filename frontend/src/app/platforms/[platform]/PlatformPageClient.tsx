'use client'

import { useState, useEffect, useCallback } from 'react'
import MovieCard from '@/components/MovieCard'
import { api } from '@/lib/api'
import { useUserData } from '@/lib/useUserData'
import type { PlatformConfig } from '@/lib/platforms'
import type { Movie } from '@/types/movie'

interface Props {
  platform: PlatformConfig
}

export default function PlatformPageClient({ platform }: Props) {
  const { addToWatchlist } = useUserData()
  const [tab, setTab] = useState<'movies' | 'shows'>('movies')
  const [items, setItems] = useState<Movie[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? items.filter(m => m.title.toLowerCase().includes(query.toLowerCase()))
    : items

  const fetchPage = useCallback(async (p: number, replace = false) => {
    if (replace) setLoading(true)
    else setLoadingMore(true)
    try {
      const data = await api.getPlatformContent(platform.slug, tab, p)
      setItems(prev => replace ? data.results : [...prev, ...data.results])
      setPage(data.page)
      setTotalPages(data.totalPages)
    } catch {}
    finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [platform.slug, tab])

  useEffect(() => {
    setItems([])
    setPage(1)
    setTotalPages(1)
    setQuery('')
    fetchPage(1, true)
  }, [fetchPage])

  return (
    <div className="min-h-screen pb-24 lg:pb-8 lg:pl-24">

      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 pt-[calc(2rem_+_env(safe-area-inset-top))] pb-6 border-b border-white/[0.06]">
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 shadow-lg"
            style={{ background: platform.bg }}
          >
            <img src={`/platforms/${platform.slug}.${platform.logoExt ?? 'svg'}`} alt={platform.name} className="w-full h-full object-contain p-2" style={{ filter: platform.logoFilter }} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{platform.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Movies & shows streaming now · US catalog</p>
          </div>
        </div>

        {/* Tabs + Search */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-2">
            {(['movies', 'shows'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                  tab === t
                    ? 'bg-primary text-background shadow-[0_0_16px_rgba(6,214,224,0.25)]'
                    : 'bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground border border-white/10'
                }`}
              >
                {t === 'movies' ? 'Movies' : 'TV Shows'}
              </button>
            ))}
          </div>
          <div className="relative sm:ml-auto sm:w-64">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`Search ${platform.name}...`}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 focus:bg-white/8 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="px-4 sm:px-6 lg:px-8 pt-6">
        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
            {Array.from({ length: 21 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <p className="text-muted-foreground text-sm">
              {query.trim() ? `No results for "${query}"` : `No titles found for ${platform.name}`}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
              {filtered.map(item => (
                <MovieCard key={item._id} movie={item} onAddToWatchlist={addToWatchlist} />
              ))}
            </div>

            {!query.trim() && page < totalPages && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={() => fetchPage(page + 1)}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-6 py-3 bg-primary/10 border border-primary/20 text-primary font-semibold text-sm rounded-xl hover:bg-primary/20 transition-all disabled:opacity-50"
                >
                  {loadingMore ? (
                    <><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />Loading...</>
                  ) : (
                    `Load More · Page ${page + 1} of ${totalPages}`
                  )}
                </button>
              </div>
            )}

            {!query.trim() && page >= totalPages && (
              <p className="text-center text-xs text-muted-foreground/50 mt-10">
                All {items.length} titles loaded
              </p>
            )}

            {query.trim() && (
              <p className="text-center text-xs text-muted-foreground/50 mt-10">
                {filtered.length} result{filtered.length !== 1 ? 's' : ''} from {items.length} loaded titles
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
