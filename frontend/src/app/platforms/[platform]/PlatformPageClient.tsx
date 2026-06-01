'use client'

import { useState, useEffect, useCallback } from 'react'
import MovieCard from '@/components/MovieCard'
import { api } from '@/lib/api'
import { useUserData } from '@/lib/useUserData'
import type { PlatformConfig } from '@/lib/platforms'
import type { Movie } from '@/types/movie'

const TMDB_LOGO = 'https://image.tmdb.org/t/p/w92'

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
  const [logoPath, setLogoPath] = useState('')

  useEffect(() => {
    api.getProviders()
      .then(data => {
        const p = data.find(pr => pr.provider_id === platform.providerId)
        if (p) setLogoPath(p.logo_path)
      })
      .catch(() => {})
  }, [platform.providerId])

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
    fetchPage(1, true)
  }, [fetchPage])

  return (
    <div className="min-h-screen pb-24 lg:pb-8 lg:pl-24">

      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 pt-8 pb-6 border-b border-white/[0.06]">
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 shadow-lg"
            style={{ background: platform.bg }}
          >
            {logoPath ? (
              <img src={`${TMDB_LOGO}${logoPath}`} alt={platform.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">{platform.name[0]}</span>
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{platform.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Movies & shows streaming now · US catalog</p>
          </div>
        </div>

        {/* Tabs */}
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
      </div>

      {/* Grid */}
      <div className="px-4 sm:px-6 lg:px-8 pt-6">
        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
            {Array.from({ length: 21 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <p className="text-muted-foreground text-sm">No titles found for {platform.name}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
              {items.map(item => (
                <MovieCard key={item._id} movie={item} onAddToWatchlist={addToWatchlist} />
              ))}
            </div>

            {page < totalPages && (
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

            {page >= totalPages && (
              <p className="text-center text-xs text-muted-foreground/50 mt-10">
                All {items.length} titles loaded
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
