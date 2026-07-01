'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

const LIVETV_API = '/api/livetv'

interface Channel {
  id: string
  name: string
  logo: string | null
  group: string
  url: string
  direct: boolean
  hd: boolean
}

const TUNING_MESSAGES = [
  '📡 Tuning the antenna…',
  '🔍 Scanning the airwaves…',
  '⚡ Finding streams that actually work…',
  '🏏 Warming up the pitch…',
  '🌍 Locking onto live signals…',
  '📺 Almost live…',
]

// Playful "tuning in" state — animated signal + rotating copy + shimmer grid,
// so it reads as "content incoming" rather than "you're stuck waiting".
function TuningState() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI(v => (v + 1) % TUNING_MESSAGES.length), 1800)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center w-24 h-24 mb-5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '1.8s' }} />
        <span className="absolute inline-flex h-16 w-16 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '1.8s', animationDelay: '0.3s' }} />
        <div className="relative z-10 flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25">
          <svg className="w-7 h-7 text-primary" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="1" />
            <path d="M18.4,5.6L17,7.1c1.3,1.3,2,3.1,2,4.9s-0.7,3.6-2.1,5l1.4,1.4c1.7-1.7,2.6-4,2.6-6.4S20.1,7.3,18.4,5.6z" />
            <path d="M7.1,7L5.6,5.6C3.9,7.3,3,9.6,3,12c0,2.4,0.9,4.7,2.6,6.4L7,16.9c-1.3-1.3-2-3.1-2-4.9S5.7,8.4,7.1,7z" />
            <path d="M15.5,8.5l-1.4,1.4c0.6,0.6,0.9,1.3,0.9,2.1c0,0.8-0.3,1.5-0.9,2.1l1.4,1.4c1-1,1.5-2.2,1.5-3.5S16.5,9.4,15.5,8.5z" />
            <path d="M8.5,8.5C7.5,9.4,7,10.6,7,12c0,1.4,0.5,2.6,1.5,3.5l1.4-1.4C9.3,13.5,9,12.8,9,12c0-0.8,0.3-1.5,0.9-2.1L8.5,8.5z" />
          </svg>
        </div>
      </div>
      <style>{`@keyframes ltvFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
      <p key={i} style={{ animation: 'ltvFade 0.4s ease' }} className="text-sm font-medium text-white/70 mb-1">{TUNING_MESSAGES[i]}</p>
      <p className="text-xs text-white/25">Only channels that actually stream make the cut</p>
    </div>
  )
}

function ChannelCard({ ch }: { ch: Channel }) {
  const [imgOk, setImgOk] = useState(true)
  return (
    <Link
      href={`/livetv/watch/${encodeURIComponent(ch.id)}?name=${encodeURIComponent(ch.name)}`}
      className="group relative flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-primary/30 transition-all"
    >
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black/40 flex items-center justify-center">
        {ch.logo && imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ch.logo}
            alt={ch.name}
            onError={() => setImgOk(false)}
            className="max-w-[75%] max-h-[75%] object-contain"
          />
        ) : (
          <span className="text-2xl font-bold text-white/20">{ch.name.slice(0, 2).toUpperCase()}</span>
        )}
        <span className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-600 text-white text-[9px] font-bold tracking-wider">
          <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
          LIVE
        </span>
        {ch.hd && (
          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-primary/20 border border-primary/40 text-primary text-[9px] font-bold tracking-wider backdrop-blur-sm">
            HD
          </span>
        )}
      </div>
      <p className="text-xs font-semibold text-white/70 text-center line-clamp-2 leading-snug group-hover:text-white transition-colors">
        {ch.name}
      </p>
    </Link>
  )
}

export default function LiveTvPage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string>('All')

  const fetchChannels = useCallback(async () => {
    try {
      const r = await fetch(`${LIVETV_API}/channels`)
      const d = await r.json()
      setChannels(d.channels || [])
      setRefreshing(!!d.refreshing)
    } catch { /* keep old */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchChannels()
    const t = setInterval(fetchChannels, 60_000)
    return () => clearInterval(t)
  }, [fetchChannels])

  const groups = useMemo(() => {
    // Preserve the backend's group order (Sports → News → Hindi News → TV → Movies).
    const seen: string[] = []
    channels.forEach(c => { if (!seen.includes(c.group)) seen.push(c.group) })
    return ['All', ...seen]
  }, [channels])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return channels.filter(c =>
      (group === 'All' || c.group === group) &&
      (!q || c.name.toLowerCase().includes(q))
    )
  }, [channels, query, group])

  return (
    <>
      <Sidebar />
      <div className="min-h-screen pb-24 lg:pb-8 pt-[calc(1.25rem_+_env(safe-area-inset-top))] px-4 sm:px-6 lg:pl-28 lg:pr-8">

        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-white">Live TV</h1>
          {channels.length > 0 && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {channels.length} live
            </span>
          )}
        </div>
        <p className="text-xs text-white/30 mb-5">Free sports &amp; TV channels · only channels that pass a live check are shown</p>

        {/* Search + group filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search channels…"
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-primary/40 transition-all"
          />
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {groups.map(g => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  group === g
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'bg-white/[0.04] text-white/45 border border-white/[0.07] hover:text-white/70'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {channels.length === 0 && (loading || refreshing) ? (
          <div className="py-10">
            <TuningState />
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 mt-10 opacity-40">
              {Array.from({ length: 18 }).map((_, i) => (
                <div key={i} className="aspect-[4/5] rounded-2xl bg-white/[0.04] animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
              ))}
            </div>
          </div>
        ) : channels.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-3xl">📺</div>
            <p className="text-white/50 font-medium">No channels available right now</p>
            <p className="text-white/25 text-sm">Live sources come and go — try refreshing in a bit</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-white/40">No channels match &ldquo;{query}&rdquo;</div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {filtered.map(ch => <ChannelCard key={ch.id} ch={ch} />)}
          </div>
        )}
      </div>
    </>
  )
}
