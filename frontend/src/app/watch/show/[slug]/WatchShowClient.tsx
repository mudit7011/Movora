'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Movie } from '@/types/movie'
import MovieCard from '@/components/MovieCard'
import EpisodeGrid from '@/components/EpisodeGrid'
import { useUserData } from '@/lib/useUserData'
import { useTV } from '@/components/TvProvider'

interface Source {
  serverName: string
  url: string
  quality: string
}

function buildSources(tmdbId: string, season: number, episode: number): Source[] {
  const rawId = tmdbId.replace(/^tv_/, '')
  return [
    { serverName: 'Server 1', url: `https://player.videasy.net/tv/${rawId}/${season}/${episode}?color=06D6E0&autoplay=1&nextEpisode=true&episodeSelector=true&autoplayNextEpisode=false&overlay=true`,   quality: 'HD' },
    { serverName: 'Server 2', url: `https://vidlink.pro/tv/${rawId}/${season}/${episode}?primaryColor=06D6E0&autoplay=true&nextbutton=true`, quality: 'HD' },
    { serverName: 'Server 3', url: `https://embedmaster.link/tv/${rawId}/${season}/${episode}`,     quality: 'HD' },
    { serverName: 'Server 4', url: `https://streamvaultsrc.click/embed/tv/${rawId}/${season}/${episode}?autoplay=true&color=%2306D6E0&autonext=false`, quality: 'HD' },
  ]
}

interface Props {
  show: Movie
  initialSeason: number
  initialEpisode: number
  related: { similar: Movie[]; youMayLove: Movie[] }
}

export default function WatchShowClient({ show, initialSeason, initialEpisode, related }: Props) {
  const isTV   = useTV()
  const router = useRouter()
  const [season, setSeason] = useState(initialSeason)
  const [episode, setEpisode] = useState(initialEpisode)
  const [activeServerIdx, setActiveServerIdx] = useState(0)
  const bannerTimer = useRef<ReturnType<typeof setTimeout>>()
  const { updateProgress } = useUserData()

  const sources = buildSources(show.tmdbId, season, episode)
  const active = sources[activeServerIdx]

  const seasons = show.seasonData?.filter(s => s.seasonNumber > 0) ?? []
  const activeSeason = seasons.find(s => s.seasonNumber === season)
  const episodeCount = activeSeason?.episodeCount ?? 0

  const hasNextEpisode = episode < episodeCount
  const hasNextServer = activeServerIdx < sources.length - 1

  useEffect(() => {
    return () => clearTimeout(bannerTimer.current)
  }, [activeServerIdx, season, episode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'n' || e.key === 'N') {
        if (hasNextServer) setActiveServerIdx(i => i + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasNextServer])

  // Track watch progress for Continue Watching
  useEffect(() => {
    const episodeDuration = 2700 // ~45 min default
    const nextEp = episode < episodeCount ? episode + 1 : undefined
    // Resume from saved position so progress accumulates across sessions
    let elapsed = 60
    try {
      const stored: { movieId: string; timestamp: number; season?: number; episode?: number }[] =
        JSON.parse(localStorage.getItem('movora_progress') || '[]')
      const saved = stored.find(p => p.movieId === show._id && p.season === season && p.episode === episode)
      if (saved?.timestamp) elapsed = saved.timestamp
    } catch {}
    updateProgress(show, elapsed, episodeDuration, season, episode, nextEp !== undefined ? season : undefined, nextEp)
    const interval = setInterval(() => {
      elapsed = Math.min(elapsed + 60, episodeDuration - 30)
      updateProgress(show, elapsed, episodeDuration, season, episode, nextEp !== undefined ? season : undefined, nextEp)
    }, 60_000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show._id, season, episode, episodeCount])

  function selectEpisode(s: number, ep: number) {
    setSeason(s)
    setEpisode(ep)
    setActiveServerIdx(0)
    router.replace(`/watch/show/${show.slug}?season=${s}&episode=${ep}`, { scroll: false })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function tryNextServer() {
    if (hasNextServer) setActiveServerIdx(i => i + 1)
  }

  function nextEpisode() {
    if (hasNextEpisode) selectEpisode(season, episode + 1)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden lg:pl-24">

      {/* Ambient backdrop */}
      {show.backdropUrl && (
        <div className="absolute inset-0 pointer-events-none z-0">
          <img
            src={show.backdropUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-[0.07] blur-2xl scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        </div>
      )}

      {/* Top bar */}
      <div className="relative z-10 flex items-center gap-3 px-4 sm:px-6 lg:px-8 py-3 lg:py-4 border-b border-white/[0.06] bg-background/80 backdrop-blur-md sticky top-0">
        <Link
          href={`/show/${show.slug}`}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
          aria-label="Back"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>

        <Link href="/" className="select-none flex-shrink-0 hidden sm:block">
          <span className="text-base font-bold tracking-tight">
            <span className="text-foreground">Mo</span><span className="text-primary">vora</span>
          </span>
        </Link>

        <div className="h-4 w-px bg-white/10 flex-shrink-0 hidden sm:block" />

        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate">{show.title}</p>
          <p className="text-white/35 text-xs">S{String(season).padStart(2,'0')} E{String(episode).padStart(2,'0')}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-full font-semibold">
            {active.quality}
          </span>
          <span className="hidden sm:inline text-xs text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full font-medium">
            {active.serverName}
          </span>
        </div>
      </div>

      {/* ── Player ── */}
      <div className="relative z-10 w-full bg-black lg:bg-transparent lg:px-6 lg:pt-4">
        <div className="relative w-full lg:rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
          <iframe
            key={`${active.url}`}
            src={active.url}
            title={`${show.title} S${season}E${episode} — ${active.serverName}`}
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer"
            allowFullScreen
            referrerPolicy="no-referrer"
            className="w-full h-full bg-black"
            style={{ border: 'none', display: 'block' }}
            scrolling="no"
          />
        </div>
      </div>

      {/* Content below player */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 lg:pb-8 space-y-5">

        {/* Server switcher */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Select Server</p>
            {hasNextServer && (
              <button onClick={tryNextServer} className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                Next →
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {sources.map((src, i) => (
              <button
                key={i}
                onClick={() => setActiveServerIdx(i)}
                data-focusable={isTV ? '' : undefined}
                tabIndex={isTV ? 0 : undefined}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                  i === activeServerIdx
                    ? 'bg-primary text-background shadow-[0_0_20px_rgba(6,214,224,0.3)]'
                    : 'bg-white/5 text-white/55 hover:bg-white/10 hover:text-white border border-white/10 hover:border-primary/30'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${i === activeServerIdx ? 'bg-background' : 'bg-white/20'}`} />
                {src.serverName}
              </button>
            ))}
          </div>
          <div className="flex items-start gap-2 pt-3 border-t border-white/[0.05]">
            <svg className="w-3.5 h-3.5 text-white/20 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
            </svg>
            <p className="text-[11px] text-white/25 leading-relaxed">
              Audio language depends on server availability. For Hindi audio, tap <span className="text-white/40">⚙ Settings → Servers → Fade</span> inside the player (Server 1 only). Not all titles have Hindi available.
            </p>
          </div>
        </div>

        {/* Episode selector */}
        {seasons.length > 0 && (
          <div className="glass rounded-2xl p-5">
            <EpisodeGrid
              show={show}
              currentSeason={season}
              currentEpisode={episode}
              onSelect={(s, ep) => selectEpisode(s, ep)}
            />
          </div>
        )}

        {/* Show info card */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="flex flex-col sm:flex-row gap-0">
            {show.posterUrl && (
              <div className="flex-shrink-0 w-full sm:w-48 sm:self-stretch">
                <div className="relative h-52 sm:h-full">
                  <img
                    src={show.posterUrl}
                    alt={show.title}
                    className="absolute inset-0 w-full h-full object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b sm:bg-gradient-to-r from-transparent to-[#0f0f0f]/70" />
                </div>
              </div>
            )}

            <div className="flex-1 p-5 sm:p-6">
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-semibold mb-2">
                TV Series
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1">{show.title}</h2>
              {show.titleHindi && (
                <p className="text-sm text-muted-foreground mb-3">{show.titleHindi}</p>
              )}

              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="flex items-center gap-1.5 text-accent">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  <span className="text-sm font-bold">{show.rating > 0 ? show.rating.toFixed(1) : 'N/A'}</span>
                </div>
                <span className="text-white/30">·</span>
                <span className="text-sm text-muted-foreground">{show.releaseYear}</span>
                {show.seasons && show.seasons > 0 && (
                  <>
                    <span className="text-white/30">·</span>
                    <span className="text-sm text-muted-foreground">{show.seasons} Season{show.seasons !== 1 ? 's' : ''}</span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {show.genres.map(g => (
                  <span key={g} className="px-2.5 py-1 text-xs font-medium text-foreground/80 bg-white/5 rounded-full border border-white/10">{g}</span>
                ))}
                {show.language.map(l => (
                  <span key={l} className="px-2.5 py-1 text-xs font-medium text-primary bg-primary/10 rounded-full border border-primary/20">{l}</span>
                ))}
              </div>

              {show.synopsis && (
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">{show.synopsis}</p>
              )}

              <Link
                href={`/show/${show.slug}`}
                className="inline-flex items-center gap-1.5 mt-4 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Full details & cast
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 6h8M6 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            </div>
          </div>
        </div>

        {/* Cast */}
        {show.cast.length > 0 && (
          <div className="glass rounded-2xl p-5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-4">Cast</p>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
              {show.cast.slice(0, 12).map((member, i) => (
                <div key={i} className="flex-shrink-0 text-center w-16">
                  <div className="w-12 h-12 mx-auto rounded-full overflow-hidden bg-card ring-1 ring-white/10 mb-2">
                    {member.photo ? (
                      <img src={member.photo} alt={member.name} width={48} height={48} className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-base font-semibold text-muted-foreground">{member.name[0]}</div>
                    )}
                  </div>
                  <p className="text-[10px] text-foreground font-medium line-clamp-2 leading-tight">{member.name}</p>
                  {member.character && (
                    <p className="text-[9px] text-muted-foreground line-clamp-1 mt-0.5">{member.character}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* More Like This */}
        {related.similar.length > 0 && (
          <div className="glass rounded-2xl p-5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-4">More Like This</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {related.similar.slice(0, 12).map(m => (
                <MovieCard key={m._id} movie={m} />
              ))}
            </div>
          </div>
        )}

        {/* You May Also Love */}
        {related.youMayLove.length > 0 && (
          <div className="glass rounded-2xl p-5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-4">You May Also Love</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {related.youMayLove.slice(0, 12).map(m => (
                <MovieCard key={m._id} movie={m} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
