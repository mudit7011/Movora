'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AdminShell from '@/components/admin/AdminShell'
import { adminApi } from '@/lib/adminApi'

interface Stats { total: number; totalMovies: number; totalShows: number; recentMovies: any[] }

const statCards = (s: Stats) => [
  {
    label: 'Total Content',
    value: s.total.toLocaleString(),
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      </svg>
    ),
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
  },
  {
    label: 'Movies',
    value: s.totalMovies.toLocaleString(),
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1z"/>
      </svg>
    ),
    color: 'text-accent',
    bg: 'bg-accent/10',
    border: 'border-accent/20',
  },
  {
    label: 'TV Shows',
    value: s.totalShows.toLocaleString(),
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2" y="7" width="20" height="13" rx="2"/><polyline points="17 2 12 7 7 2"/>
      </svg>
    ),
    color: 'text-secondary',
    bg: 'bg-secondary/10',
    border: 'border-secondary/20',
  },
]

export default function AdminDashboard() {
  const [stats, setStats]   = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => {
    adminApi.getStats()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AdminShell>
      <div className="p-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Welcome back. Here's what's happening on Movora.</p>
        </div>

        {loading && (
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Loading stats...
          </div>
        )}

        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6">
            {error}
          </div>
        )}

        {stats && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
              {statCards(stats).map(card => (
                <div key={card.label} className={`glass rounded-2xl p-5 border ${card.border}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-2.5 rounded-xl ${card.bg} ${card.color}`}>
                      {card.icon}
                    </div>
                  </div>
                  <p className={`text-3xl font-bold ${card.color} mb-1`}>{card.value}</p>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div className="flex gap-3 mb-10">
              <Link
                href="/admin/movies"
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-background font-medium text-sm rounded-xl hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(6,214,224,0.2)]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Manage Content
              </Link>
              <Link
                href="/admin/scrape"
                className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 hover:border-primary/30 text-foreground font-medium text-sm rounded-xl transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a10 10 0 1 0 10 10"/><path d="M18 2v4h4"/>
                </svg>
                Scrape Jobs
              </Link>
            </div>

            {/* Recent content */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-4">Recently Added</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                {stats.recentMovies.map(m => (
                  <Link key={m._id} href={`/${m.type === 'tvshow' ? 'show' : 'movie'}/${m.slug}`} target="_blank">
                    <div className="group relative aspect-[2/3] rounded-xl overflow-hidden bg-card ring-1 ring-white/[0.06] hover:ring-primary/30 transition-all">
                      {m.posterUrl
                        ? <img src={m.posterUrl} alt={m.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        : <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs text-center px-2">{m.title}</div>
                      }
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] text-white font-medium line-clamp-2 leading-tight">{m.title}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  )
}
