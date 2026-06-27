'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

const SPORTS_API = '/api/sports'

interface Team { name: string; badge?: string }
interface Match {
  id: string
  title: string
  category: string
  date: number
  popular: boolean
  isLive: boolean
  formattedTime: string
  formattedDate: string
  poster?: string
  teams?: { home: Team; away: Team }
  sources: { source: string; id: string }[]
}
interface SportCategory { id: string; name: string }

const SPORT_EMOJI: Record<string, string> = {
  football: '⚽', cricket: '🏏', basketball: '🏀', tennis: '🎾',
  hockey: '🏒', baseball: '⚾', rugby: '🏉', golf: '⛳',
  'motor-sports': '🏎️', motorsport: '🏎️', fight: '🥊', afl: '🏈',
  darts: '🎯', billiards: '🎱', other: '🏆',
}

const SPORT_ACCENT: Record<string, string> = {
  football: '#166534', cricket: '#1e3a5f', basketball: '#7c2d12',
  tennis: '#3f6212', 'motor-sports': '#7f1d1d', motorsport: '#7f1d1d',
  hockey: '#0c4a6e', rugby: '#581c87', fight: '#881337', afl: '#78350f',
  baseball: '#134e4a', golf: '#3b4106', darts: '#312e81', billiards: '#1c1917',
  other: '#1f2937',
}

function matchHref(match: Match) {
  const src = match.sources?.[0]
  if (!src) return `/sports/watch/${encodeURIComponent(match.id)}`
  return `/sports/watch/${encodeURIComponent(match.id)}?source=${src.source}`
}

function MatchCard({ match, compact }: { match: Match; compact?: boolean }) {
  const emoji = SPORT_EMOJI[match.category] ?? '🏆'
  const displayTitle = match.teams
    ? `${match.teams.home.name} vs ${match.teams.away.name}`
    : match.title

  return (
    <Link
      href={matchHref(match)}
      className={`group relative overflow-hidden rounded-xl block ${compact ? 'flex-shrink-0 w-[220px]' : 'w-full'}`}
      style={{ height: compact ? 148 : 170 }}
    >
      {match.poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={match.poster}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${SPORT_ACCENT[match.category] ?? '#1a1a2e'} 0%, #0a0a0f 100%)` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
      <div className="absolute top-2.5 left-2.5">
        {match.isLive ? (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-bold tracking-wider">
            <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
            LIVE
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-md bg-black/70 text-white/60 text-[10px] font-medium backdrop-blur-sm">
            {match.formattedTime}
          </span>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-white font-semibold text-xs leading-snug line-clamp-2 mb-0.5">
          {displayTitle}
        </p>
        <p className="text-white/40 text-[10px] capitalize">
          {emoji} {match.category.replace(/-/g, ' ')}
        </p>
      </div>
    </Link>
  )
}

function CategoryTiles({
  categoryRows,
  onSelect,
}: {
  categoryRows: (SportCategory & { matches: Match[] })[]
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex gap-3 overflow-x-auto px-4 sm:px-6 lg:pl-28 pr-4 pb-1 mb-8 scrollbar-hide">
      {categoryRows.map(cat => {
        const cover = cat.matches.find(m => m.poster)
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className="group relative flex-shrink-0 w-40 h-24 rounded-xl overflow-hidden"
          >
            {cover?.poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover.poster}
                alt={cat.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{ background: `linear-gradient(135deg, ${SPORT_ACCENT[cat.id] ?? '#1a1a2e'} 0%, #0a0a0f 100%)` }}
              />
            )}
            <div className="absolute inset-0 bg-black/45 group-hover:bg-black/30 transition-colors" />
            <div className="absolute inset-0 flex items-end p-3">
              <span className="text-white font-bold text-sm leading-tight drop-shadow-lg">
                {cat.name}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function CategoryRow({
  label, badge, matches, onSeeAll,
}: {
  label: string
  badge?: React.ReactNode
  matches: Match[]
  onSeeAll?: () => void
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:pl-28 lg:pr-8 mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-white">{label}</h2>
          {badge}
        </div>
        {onSeeAll && (
          <button
            onClick={onSeeAll}
            className="text-[11px] text-white/30 hover:text-white/60 flex items-center gap-1 transition-colors"
          >
            See all
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 6h8M6 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 sm:px-6 lg:pl-28 pr-4 pb-1 scrollbar-hide">
        {matches.map(m => <MatchCard key={m.id} match={m} compact />)}
      </div>
    </div>
  )
}

function SportFilterView({
  category, matches, onBack,
}: { category: SportCategory; matches: Match[]; onBack: () => void }) {
  const emoji = SPORT_EMOJI[category.id] ?? '🏆'
  return (
    <div className="pt-[calc(0.75rem_+_env(safe-area-inset-top))] px-4 sm:px-6 lg:pl-28 lg:pr-8">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.07] transition-all"
        >
          <svg className="w-4 h-4 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <span>{emoji}</span> {category.name}
          <span className="text-white/30 text-sm font-normal">({matches.length})</span>
        </h1>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {matches.map(m => <MatchCard key={m.id} match={m} />)}
      </div>
    </div>
  )
}

function SkeletonCards() {
  return (
    <div className="flex gap-3 px-4 sm:px-6 lg:pl-28 pr-4 overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-[220px] h-[148px] rounded-xl bg-white/[0.04] animate-pulse" />
      ))}
    </div>
  )
}

export default function SportsPage() {
  const [allMatches, setAllMatches] = useState<Match[]>([])
  const [categories, setCategories] = useState<SportCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      // Events come from our backend which proxies streamed.su
      const eventsRes = await fetch(`${SPORTS_API}/events`)
      const eventsData = await eventsRes.json()
      const matches: Match[] = eventsData.events || []
      setAllMatches(matches)

      // Derive categories from the matches themselves
      const catMap = new Map<string, string>()
      for (const m of matches) {
        if (m.category && !catMap.has(m.category)) {
          const name = m.category
            .replace(/-/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase())
          catMap.set(m.category, name)
        }
      }
      setCategories([...catMap.entries()].map(([id, name]) => ({ id, name })))
      setLastUpdated(new Date())
    } catch {
      // silently retry
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 60_000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const liveMatches = allMatches.filter(m => m.isLive)
  const popularLive = allMatches.filter(m => m.isLive && m.popular)
  const categoryRows = categories
    .map(cat => ({ ...cat, matches: allMatches.filter(m => m.category === cat.id) }))
    .filter(c => c.matches.length > 0)

  if (activeFilter) {
    const cat = categories.find(c => c.id === activeFilter)
    const matches = allMatches.filter(m => m.category === activeFilter)
    if (cat) return (
      <>
        <Sidebar />
        <div className="min-h-screen pb-24 lg:pb-8">
          <SportFilterView category={cat} matches={matches} onBack={() => setActiveFilter(null)} />
        </div>
      </>
    )
  }

  return (
    <>
      <Sidebar />
      <div className="min-h-screen pb-24 lg:pb-8 pt-[calc(1.25rem_+_env(safe-area-inset-top))]">

        <div className="flex items-center justify-between px-4 sm:px-6 lg:pl-28 lg:pr-8 mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Live Sports</h1>
            {liveMatches.length > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                {liveMatches.length} live
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-[11px] text-white/20 hidden sm:block">
                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={fetchAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white/35 hover:text-white/65 border border-white/[0.07] hover:border-white/15 transition-all"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <>
            <div className="flex gap-3 px-4 sm:px-6 lg:pl-28 pr-4 mb-8 overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-40 h-24 rounded-xl bg-white/[0.04] animate-pulse" />
              ))}
            </div>
            <SkeletonCards />
          </>
        ) : allMatches.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-3xl">🏆</div>
            <p className="text-white/50 font-medium">No events available</p>
            <p className="text-white/25 text-sm">Check back later or refresh</p>
          </div>
        ) : (
          <>
            {categoryRows.length > 0 && (
              <CategoryTiles categoryRows={categoryRows} onSelect={setActiveFilter} />
            )}
            {popularLive.length > 0 && (
              <CategoryRow
                label="Popular Live"
                badge={
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold">
                    <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                    LIVE
                  </span>
                }
                matches={popularLive}
              />
            )}
            {liveMatches.length > 0 && popularLive.length === 0 && (
              <CategoryRow
                label="Live Now"
                badge={
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold">
                    <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                    LIVE
                  </span>
                }
                matches={liveMatches}
              />
            )}
            {categoryRows.map(cat => (
              <CategoryRow
                key={cat.id}
                label={`${SPORT_EMOJI[cat.id] ?? '🏆'} ${cat.name}`}
                matches={cat.matches}
                onSeeAll={() => setActiveFilter(cat.id)}
              />
            ))}
          </>
        )}
      </div>
    </>
  )
}
