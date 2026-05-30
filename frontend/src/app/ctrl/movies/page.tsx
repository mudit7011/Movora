'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import AdminShell from '@/components/admin/AdminShell'
import { adminApi } from '@/lib/adminApi'

export default function AdminMoviesPage() {
  const [items, setItems]   = useState<any[]>([])
  const [total, setTotal]   = useState(0)
  const [pages, setPages]   = useState(1)
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [query, setQuery]   = useState('')
  const [loading, setLoading]   = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError]   = useState('')

  // Duplicates panel state
  const [showDupes, setShowDupes]           = useState(false)
  const [dupesData, setDupesData]           = useState<any>(null)
  const [dupesLoading, setDupesLoading]     = useState(false)
  const [dupesError, setDupesError]         = useState('')
  const [deletingDupe, setDeletingDupe]     = useState<string | null>(null)
  const [deletingAll, setDeletingAll]       = useState(false)
  const [deleteAllMsg, setDeleteAllMsg]     = useState('')

  // Import modal state
  const [showImport, setShowImport]         = useState(false)
  const [importSearch, setImportSearch]     = useState('')
  const [importType, setImportType]         = useState<'movie' | 'tv'>('movie')
  const [tmdbResults, setTmdbResults]       = useState<any[]>([])
  const [tmdbLoading, setTmdbLoading]       = useState(false)
  const [importingId, setImportingId]       = useState<number | null>(null)
  const [importMsg, setImportMsg]           = useState<{ ok: boolean; text: string } | null>(null)
  const [importedIds, setImportedIds]       = useState<Set<number>>(new Set())

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true)
    setError('')
    try {
      const data = await adminApi.getMovies(p, q)
      setItems(data.items)
      setTotal(data.total)
      setPages(data.pages)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(page, query) }, [page, query, load])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setQuery(search)
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    setDeleting(id)
    try {
      await adminApi.deleteMovie(id)
      setItems(prev => prev.filter(m => m._id !== id))
      setTotal(t => t - 1)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDeleting(null)
    }
  }

  async function handleDeleteAll() {
    if (!confirm('Saare duplicates delete kar dun? Har group ka best entry rakhega, baaki delete ho jayenge.')) return
    setDeletingAll(true)
    setDeleteAllMsg('')
    try {
      const res = await adminApi.deleteAllDuplicates()
      setDeleteAllMsg(`${res.deleted} duplicates deleted!`)
      setTotal(t => t - res.deleted)
      setDupesData(null)
      // Refresh duplicate list
      await loadDuplicates()
    } catch (e: any) {
      setDeleteAllMsg(e.message)
    } finally {
      setDeletingAll(false)
    }
  }

  async function loadDuplicates() {
    setDupesLoading(true)
    setDupesError('')
    try {
      const data = await adminApi.getDuplicates()
      setDupesData(data)
    } catch (e: any) {
      setDupesError(e.message)
    } finally {
      setDupesLoading(false)
    }
  }

  async function handleDeleteDupe(id: string) {
    setDeletingDupe(id)
    try {
      await adminApi.deleteMovie(id)
      // Remove from both groups
      setDupesData((prev: any) => {
        if (!prev) return prev
        const strip = (groups: any[]) => groups
          .map((g: any) => ({ ...g, items: g.items.filter((it: any) => String(it._id) !== id) }))
          .filter((g: any) => g.items.length > 1)
        return {
          ...prev,
          byTmdbId:    strip(prev.byTmdbId),
          byTitleYear: strip(prev.byTitleYear),
          total: prev.total,
        }
      })
      setTotal(t => t - 1)
    } catch (e: any) {
      setDupesError(e.message)
    } finally {
      setDeletingDupe(null)
    }
  }

  async function handleTmdbSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!importSearch.trim()) return
    setTmdbLoading(true)
    setTmdbResults([])
    setImportMsg(null)
    try {
      const results = await adminApi.tmdbSearch(importSearch.trim(), importType)
      setTmdbResults(results)
    } catch (e: any) {
      setImportMsg({ ok: false, text: e.message })
    } finally {
      setTmdbLoading(false)
    }
  }

  async function handleImport(tmdbId: number) {
    setImportingId(tmdbId)
    setImportMsg(null)
    try {
      const res = await adminApi.tmdbImport(tmdbId, importType)
      setImportMsg({ ok: true, text: `"${res.title}" added successfully!` })
      setImportedIds(prev => new Set(prev).add(tmdbId))
      setTotal(t => t + 1)
    } catch (e: any) {
      setImportMsg({ ok: false, text: e.message })
    } finally {
      setImportingId(null)
    }
  }

  return (
    <AdminShell>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Content</h1>
            <p className="text-sm text-muted-foreground mt-1">{total.toLocaleString()} movies &amp; shows in database</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowDupes(d => !d); if (!dupesData) loadDuplicates() }}
              className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm rounded-xl transition-all border ${
                showDupes
                  ? 'bg-orange-500/15 border-orange-500/30 text-orange-400'
                  : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="8" y="8" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Duplicates
            </button>
            <button
              onClick={() => { setShowImport(true); setImportMsg(null); setTmdbResults([]); setImportSearch(''); setImportedIds(new Set()) }}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-background font-semibold text-sm rounded-xl hover:bg-primary/90 transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
              </svg>
              Add from TMDB
            </button>
          </div>
        </div>

        {/* Import Modal */}
        {showImport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                <h2 className="text-base font-bold text-foreground">Import from TMDB</h2>
                <button
                  onClick={() => setShowImport(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Type toggle */}
                <div className="flex gap-2 p-1 bg-white/5 rounded-xl w-fit">
                  {(['movie', 'tv'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => { setImportType(t); setTmdbResults([]); setImportMsg(null); setImportedIds(new Set()) }}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        importType === t ? 'bg-primary text-background' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {t === 'movie' ? 'Movie' : 'TV Show'}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <form onSubmit={handleTmdbSearch} className="flex gap-2">
                  <input
                    value={importSearch}
                    onChange={e => setImportSearch(e.target.value)}
                    placeholder={importType === 'movie' ? 'e.g. Inception' : 'e.g. The Society'}
                    className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 focus:border-primary/50 rounded-xl text-sm text-foreground placeholder-muted-foreground outline-none transition-all"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={tmdbLoading}
                    className="px-4 py-2.5 bg-primary text-background font-semibold text-sm rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-all"
                  >
                    {tmdbLoading ? (
                      <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                    ) : 'Search'}
                  </button>
                </form>

                {/* Status message */}
                {importMsg && (
                  <div className={`px-4 py-3 rounded-xl text-sm border ${
                    importMsg.ok
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>
                    {importMsg.text}
                  </div>
                )}

                {/* Results */}
                {tmdbResults.length > 0 && (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {tmdbResults.map(r => (
                      <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 transition-all">
                        <div className="w-9 h-12 rounded-lg overflow-hidden bg-card flex-shrink-0">
                          {r.poster
                            ? <img src={r.poster} alt={r.title} className="w-full h-full object-cover" />
                            : <div className="w-full h-full bg-white/5 flex items-center justify-center text-[8px] text-muted-foreground">N/A</div>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                          <p className="text-xs text-muted-foreground">{r.year || '—'} · ★ {r.rating.toFixed(1)}</p>
                        </div>
                        {importedIds.has(r.id) ? (
                          <span className="flex-shrink-0 px-3 py-1.5 text-emerald-400 text-xs font-semibold">Added</span>
                        ) : (
                          <button
                            onClick={() => handleImport(r.id)}
                            disabled={importingId === r.id}
                            className="flex-shrink-0 px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold rounded-lg hover:bg-primary/20 disabled:opacity-50 transition-all"
                          >
                            {importingId === r.id ? (
                              <div className="w-3.5 h-3.5 border border-primary border-t-transparent rounded-full animate-spin" />
                            ) : 'Import'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!tmdbLoading && tmdbResults.length === 0 && importSearch && !importMsg && (
                  <p className="text-sm text-muted-foreground text-center py-4">No results — try a different title</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Duplicates Panel */}
        {showDupes && (
          <div className="glass rounded-2xl border border-orange-500/20 overflow-hidden mb-6">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold text-foreground">Duplicate Finder</h2>
                {dupesData && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20 font-semibold">
                    {(dupesData.byTmdbId?.length ?? 0) + (dupesData.byTitleYear?.length ?? 0)} groups found
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {deleteAllMsg && (
                  <span className="text-xs text-emerald-400 font-medium">{deleteAllMsg}</span>
                )}
                {dupesData && ((dupesData.byTmdbId?.length ?? 0) + (dupesData.byTitleYear?.length ?? 0)) > 0 && (
                  <button
                    onClick={handleDeleteAll}
                    disabled={deletingAll || dupesLoading}
                    className="px-3 py-1.5 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 disabled:opacity-50 transition-all"
                  >
                    {deletingAll ? 'Deleting...' : 'Delete All Duplicates'}
                  </button>
                )}
                <button onClick={loadDuplicates} disabled={dupesLoading} className="text-xs text-primary hover:text-primary/80 disabled:opacity-50 transition-colors font-medium">
                  {dupesLoading ? 'Scanning...' : 'Refresh'}
                </button>
              </div>
            </div>

            {dupesLoading && (
              <div className="px-5 py-10 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Scanning {total.toLocaleString()} items...
              </div>
            )}

            {dupesError && (
              <div className="px-5 py-4 text-sm text-red-400">{dupesError}</div>
            )}

            {dupesData && !dupesLoading && (
              <>
                {dupesData.byTmdbId?.length === 0 && dupesData.byTitleYear?.length === 0 ? (
                  <div className="px-5 py-10 text-center text-emerald-400 text-sm font-medium">
                    No duplicates found
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.04] max-h-[500px] overflow-y-auto">
                    {/* TMDB ID duplicates */}
                    {dupesData.byTmdbId?.map((group: any) => (
                      <div key={group.tmdbId} className="px-5 py-4">
                        <p className="text-[10px] text-orange-400/70 font-semibold uppercase tracking-wider mb-3">
                          Same TMDB ID: <span className="text-orange-400">{group.tmdbId}</span> · {group.count} copies
                        </p>
                        <div className="space-y-2">
                          {group.items.map((item: any, idx: number) => (
                            <div key={String(item._id)} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                              <div className="w-8 h-11 rounded-lg overflow-hidden bg-card flex-shrink-0">
                                {item.posterUrl ? <img src={item.posterUrl} alt={item.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-white/5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                                <p className="text-xs text-muted-foreground">{item.slug} · {item.releaseYear} · {item.sources?.length ?? 0} servers</p>
                              </div>
                              {idx === 0 && (
                                <span className="flex-shrink-0 text-[10px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">KEEP</span>
                              )}
                              {idx > 0 && (
                                <button
                                  onClick={() => handleDeleteDupe(String(item._id))}
                                  disabled={deletingDupe === String(item._id)}
                                  className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 disabled:opacity-50 transition-all"
                                >
                                  {deletingDupe === String(item._id) ? (
                                    <div className="w-3.5 h-3.5 border border-red-400 border-t-transparent rounded-full animate-spin" />
                                  ) : 'Delete'}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Title+Year duplicates */}
                    {dupesData.byTitleYear?.map((group: any, gi: number) => (
                      <div key={gi} className="px-5 py-4">
                        <p className="text-[10px] text-yellow-400/70 font-semibold uppercase tracking-wider mb-3">
                          Same Title+Year: <span className="text-yellow-400">"{group.title}" ({group.year})</span> · {group.count} copies
                        </p>
                        <div className="space-y-2">
                          {group.items.map((item: any, idx: number) => (
                            <div key={String(item._id)} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                              <div className="w-8 h-11 rounded-lg overflow-hidden bg-card flex-shrink-0">
                                {item.posterUrl ? <img src={item.posterUrl} alt={item.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-white/5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                                <p className="text-xs text-muted-foreground">{item.slug} · tmdbId: {item.tmdbId} · {item.sources?.length ?? 0} servers</p>
                              </div>
                              {idx === 0 && (
                                <span className="flex-shrink-0 text-[10px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">KEEP</span>
                              )}
                              {idx > 0 && (
                                <button
                                  onClick={() => handleDeleteDupe(String(item._id))}
                                  disabled={deletingDupe === String(item._id)}
                                  className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 disabled:opacity-50 transition-all"
                                >
                                  {deletingDupe === String(item._id) ? (
                                    <div className="w-3.5 h-3.5 border border-red-400 border-t-transparent rounded-full animate-spin" />
                                  ) : 'Delete'}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title or slug..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 focus:border-primary/50 rounded-xl text-sm text-foreground placeholder-muted-foreground outline-none transition-all"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-primary text-background font-medium text-sm rounded-xl hover:bg-primary/90 transition-all"
          >
            Search
          </button>
          {query && (
            <button
              type="button"
              onClick={() => { setSearch(''); setQuery(''); setPage(1) }}
              className="px-4 py-2.5 bg-white/5 border border-white/10 hover:border-white/20 text-sm text-muted-foreground rounded-xl transition-all"
            >
              Clear
            </button>
          )}
        </form>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="glass rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-widest w-12">#</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Title</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-widest hidden md:table-cell">Type</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-widest hidden lg:table-cell">Year</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-widest hidden lg:table-cell">Lang</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-widest hidden xl:table-cell">Rating</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-widest hidden xl:table-cell">Sources</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Loading...
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-muted-foreground">No results found.</td>
                  </tr>
                ) : items.map((item, idx) => (
                  <tr key={item._id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                    <td className="px-5 py-3 text-muted-foreground text-xs">{(page - 1) * 30 + idx + 1}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-11 rounded-lg overflow-hidden bg-card flex-shrink-0 ring-1 ring-white/[0.06]">
                          {item.posterUrl
                            ? <img src={item.posterUrl} alt={item.title} width={32} height={44} className="object-cover w-full h-full" />
                            : <div className="w-full h-full bg-white/5" />
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate max-w-[200px]">{item.title}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{item.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                        item.type === 'tvshow'
                          ? 'text-primary bg-primary/10 border-primary/20'
                          : 'text-accent bg-accent/10 border-accent/20'
                      }`}>
                        {item.type === 'tvshow' ? 'Show' : 'Movie'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground hidden lg:table-cell">{item.releaseYear}</td>
                    <td className="px-5 py-3 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(item.language || []).slice(0, 2).map((l: string) => (
                          <span key={l} className="text-[10px] px-1.5 py-0.5 bg-white/5 rounded-md text-muted-foreground border border-white/10">
                            {l}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 hidden xl:table-cell">
                      <span className="flex items-center gap-1 text-accent">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        {item.rating > 0 ? item.rating.toFixed(1) : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3 hidden xl:table-cell">
                      <span className={`text-xs font-medium ${(item.sources?.length ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {item.sources?.length ?? 0} server{item.sources?.length !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/${item.type === 'tvshow' ? 'show' : 'movie'}/${item.slug}`}
                          target="_blank"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                          title="View"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        </Link>
                        <button
                          onClick={() => handleDelete(item._id, item.title)}
                          disabled={deleting === item._id}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                          title="Delete"
                        >
                          {deleting === item._id
                            ? <div className="w-4 h-4 border border-red-400 border-t-transparent rounded-full animate-spin" />
                            : (
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                              </svg>
                            )
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-white/[0.06]">
              <p className="text-xs text-muted-foreground">
                Page {page} of {pages} · {total.toLocaleString()} total
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 hover:border-primary/30 rounded-lg text-muted-foreground disabled:opacity-40 transition-all"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={page === pages}
                  className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 hover:border-primary/30 rounded-lg text-muted-foreground disabled:opacity-40 transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  )
}
