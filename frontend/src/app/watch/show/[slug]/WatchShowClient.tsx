'use client'

import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { Movie } from '@/types/movie'
import EpisodeGrid from '@/components/EpisodeGrid'
import { useUserData } from '@/lib/useUserData'
import { useTV } from '@/components/TvProvider'
import dynamic from 'next/dynamic'
const VideoPlayer = dynamic(() => import('@/components/VideoPlayer'), { ssr: false })
const MovoraStreamPlayer = dynamic(() => import('@/components/MovoraStreamPlayer'), { ssr: false })
import { extractPlayback, isEndedEvent, isKnownPlayerOrigin, isEmbedMasterReady, seekEmbedMaster, extractEpisodeNav } from '@/lib/playerProgress'

interface Source {
  serverName: string
  url: string
  quality: string
  type?: 'iframe' | 'direct'
}

const LOAD_MESSAGES = [
  { text: 'Preparing stream…',               sub: null },
  { text: 'Connecting to streaming server…', sub: null },
  { text: 'Still loading…',                  sub: 'This is taking a while.' },
  { text: 'Taking longer than expected.',     sub: 'Try another server if this keeps up.' },
] as const

function buildSources(tmdbId: string, season: number, episode: number): Source[] {
  const rawId = tmdbId.replace(/^tv_/, '')
  return [
    { serverName: 'Server 1', url: `https://player.videasy.to/tv/${rawId}/${season}/${episode}?color=06D6E0&autoplay=1&overlay=true&nextEpisode=true&episodeSelector=true&autoplayNextEpisode=true`,   quality: 'HD' },
    // Server 2 — nxsha embed (aggregates ~35 providers incl. ShowBox multi-lang + Hindi). lang=hi defaults to Hindi audio where available.
    { serverName: 'Server 2', url: `https://nxsha.space/embed/tv/${rawId}/${season}/${episode}?lang=hi`, quality: 'HD' },
    // Trimmed for a cleaner UX (Premium + Videasy + nxsha). Uncomment if a title only works on these:
    // { serverName: 'Server 3', url: `https://vidfast.pro/tv/${rawId}/${season}/${episode}?autoPlay=true&theme=06D6E0&hideServer=true&chromecast=true&title=false&poster=false&nextButton=true&autoNext=true`, quality: 'HD' },
    // { serverName: 'Server 4', url: `https://embedmaster.link/fljq7ku6ysokw3og/tv/${rawId}/${season}/${episode}`, quality: 'HD' },
    // { serverName: 'Server 5', url: `https://vidlink.pro/tv/${rawId}/${season}/${episode}?primaryColor=06D6E0&autoplay=true&nextbutton=true`, quality: 'HD' },
    // Previous Server 5 (nhdapi) — kept commented in case we want it back:
    // { serverName: 'Server 5', url: `https://nhdapi.com/embed/tv/${rawId}/${season}/${episode}?autoplay=true&autonext=true&audio=true&lang=English&title=true&download=true&setting=true&appearance=true&episodelist=true&watchparty=false&chromecast=true&pip=true&nextbutton=true&hidecontrols=false&hideserver=true&hideservericon=true&icons=sharp&logo=https://watchmovora.com/icon.svg&logowidth=36px&logoheight=36px&primarycolor=06D6E0&secondarycolor=0891B2&iconcolor=FFFFFF&iconsize=1&font=Poppins&fontcolor=FFFFFF&fontsize=20&opacity=0.50&glasscolor=000000&glassopacity=65&glassblur=20&subtitle=Off&subdelay=0&subtextsize=140&subtextcolor=FFFFFF&subcapitalize=false&subbold=false&subfont=Roboto&subbgenabled=false&subbgcolor=000000&subbgopacity=0&subbgblur=0`, quality: 'HD' },
  ]
}

interface Props {
  show: Movie
  children?: ReactNode
}

export default function WatchShowClient({ show, children }: Props) {
  const isTV = useTV()
  const searchParams = useSearchParams()
  const [season, setSeason] = useState(() => {
    const s = Number(searchParams.get('season'))
    return Number.isFinite(s) && s > 0 ? s : 1
  })
  const [episode, setEpisode] = useState(() => {
    const e = Number(searchParams.get('episode'))
    return Number.isFinite(e) && e > 0 ? e : 1
  })
  // displaySeason/displayEpisode: only for UI highlighter — updated by Videasy nav messages
  // without reloading the iframe. season/episode control the actual iframe src.
  const [displaySeason, setDisplaySeason] = useState(season)
  const [displayEpisode, setDisplayEpisode] = useState(episode)
  const [activeServerIdx, setActiveServerIdx] = useState(0)
  const [usingMovora, setUsingMovora] = useState(true)   // custom extracted-m3u8 player is the default

  const [iframeKey, setIframeKey] = useState(0)
  const manualSelectAt = useRef(0)

  const [showFallback,  setShowFallback]  = useState(false)
  const [playerLoaded,  setPlayerLoaded]  = useState(false)
  const [loadPhase,     setLoadPhase]     = useState(0)
  const iframeRef   = useRef<HTMLIFrameElement>(null)
  const loadTimers  = useRef<ReturnType<typeof setTimeout>[]>([])

  const fallbackTimer = useRef<ReturnType<typeof setTimeout>>()


  const bannerTimer = useRef<ReturnType<typeof setTimeout>>()
  const { updateProgress } = useUserData()

  const sources = buildSources(show.tmdbId, season, episode)
  const active = sources[activeServerIdx]

  // Resume position — captured once per episode so the iframe src stays stable.
  // (Recomputing per render would change ?progress= continuously and reload the player.)
  const savedTimestamp = useMemo(() => {
    try {
      const stored: { movieId: string; timestamp: number; season?: number; episode?: number }[] =
        JSON.parse(localStorage.getItem('movora_progress') || '[]')
      const saved = stored.find(p => p.movieId === show._id && p.season === season && p.episode === episode)
      return saved?.timestamp ?? 0
    } catch { return 0 }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show._id, season, episode])

  // Inject resume position per server (matched to this exact season/episode)
  const activeUrl = (() => {
    // Server 1 (Videasy): resume via ?progress=<seconds>
    if (active.url.includes('player.videasy.to') && savedTimestamp > 60) {
      return active.url + `&progress=${Math.floor(savedTimestamp)}`
    }
    // Server 2 (VidLink) + Server 4 (VidFast): resume via ?startAt=<seconds>
    if ((active.url.includes('vidlink.pro') || active.url.includes('vidfast.')) && savedTimestamp > 60) {
      return active.url + `&startAt=${Math.floor(savedTimestamp)}`
    }
    // NHD API: resume via ?progress=<seconds>
    if (active.url.includes('nhdapi.com') && savedTimestamp > 60) {
      return active.url + `&progress=${Math.floor(savedTimestamp)}`
    }
    return active.url
  })()

  const seasons = show.seasonData?.filter(s => s.seasonNumber > 0) ?? []
  const activeSeason = seasons.find(s => s.seasonNumber === season)
  const episodeCount = activeSeason?.episodeCount ?? 0

  const hasNextServer = activeServerIdx < sources.length - 1

  // Auto-suggest fallback if server doesn't respond within 15s
  useEffect(() => {
    setShowFallback(false)
    clearTimeout(fallbackTimer.current)
    fallbackTimer.current = setTimeout(() => setShowFallback(true), 15000)
    return () => {
      clearTimeout(bannerTimer.current)
      clearTimeout(fallbackTimer.current)
    }
  }, [activeServerIdx, season, episode])

  // Loading phase progression for iframe servers
  const isIframe = true
  useEffect(() => {
    if (!isIframe) return
    setPlayerLoaded(false)
    setLoadPhase(0)
    loadTimers.current.forEach(clearTimeout)
    loadTimers.current = [
      setTimeout(() => setLoadPhase(1), 1000),
      setTimeout(() => setLoadPhase(2), 3000),
      setTimeout(() => setLoadPhase(3), 5000),
    ]
    return () => loadTimers.current.forEach(clearTimeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Track watch progress for Continue Watching — counts only real foreground time.
  // Iframe embeds can't report true position cross-origin, so for non-StreamVault servers
  // this is a best-effort estimate. We never save on mount and only persist after genuine
  // watch time accrues, so opening/re-opening an episode can't inflate progress.
  useEffect(() => {
    // The Movora player reports its exact position via onProgress, so skip the iframe estimator.
    if (usingMovora) return
    const episodeDuration = 2700 // ~45 min default
    const rawId = show.tmdbId.replace(/^tv_/, '')
    const nextEp = episode < episodeCount ? episode + 1 : undefined
    const advanceSeason = nextEp !== undefined ? season : undefined

    // Restore prior position as the starting point — but do NOT re-save it on mount.
    let elapsed = 0
    try {
      const stored: { movieId: string; timestamp: number; season?: number; episode?: number }[] =
        JSON.parse(localStorage.getItem('movora_progress') || '[]')
      const saved = stored.find(p => p.movieId === show._id && p.season === season && p.episode === episode)
      if (saved?.timestamp) elapsed = saved.timestamp
    } catch {}

    const resumeTarget = elapsed // position to seek EmbedMaster back to once it's ready
    let embedSeekSent = false
    let lastTick = performance.now()
    let accrued = 0
    let realTimeReported = false
    let lastReal: { time: number; duration: number } | null = null
    let lastRealSave = 0         // throttle real-position saves to ~once per 5s
    let interval: ReturnType<typeof setInterval> | null = null

    const TICK_MS = 15_000
    const PERSIST_AFTER = 45

    const flush = () => {
      if (realTimeReported) return
      if (elapsed > 0 && accrued >= PERSIST_AFTER) {
        updateProgress(show, Math.min(elapsed, episodeDuration - 30), episodeDuration, season, episode, advanceSeason, nextEp)
      }
    }

    // Wall-clock fallback for players that report nothing (e.g. EmbedMaster).
    const tick = () => {
      if (realTimeReported) return
      const now = performance.now()
      const deltaSec = (now - lastTick) / 1000
      lastTick = now
      if (deltaSec > 0 && deltaSec < 90) {
        elapsed = Math.min(elapsed + deltaSec, episodeDuration - 30)
        accrued += deltaSec
        flush()
      }
    }

    const start = () => {
      if (interval) return
      lastTick = performance.now()
      interval = setInterval(tick, TICK_MS)
    }

    const stop = () => {
      tick()
      if (interval) { clearInterval(interval); interval = null }
    }

    const onVisibility = () => document.hidden ? stop() : start()

    // Videasy / Vidlink / StreamVault broadcast their real position (seek-accurate).
    // Match per season/episode and use the real duration when provided.
    const onMessage = (e: MessageEvent) => {
      if (!isKnownPlayerOrigin(e.origin)) return
      // EmbedMaster only resumes via command — seek it back once it's ready.
      if (resumeTarget > 60 && !embedSeekSent && isEmbedMasterReady(e.data)) {
        seekEmbedMaster(e.source as Window, resumeTarget)
        embedSeekSent = true
      }
      // Videasy episode navigation (Next Episode button, episode list, auto-advance).
      // Always sync UI only — NEVER reload the iframe from a postMessage handler.
      // Reloading unmounts the fullscreened <iframe> which forces the browser to
      // exit fullscreen per spec. Videasy handles the actual episode switch internally.
      const nav = extractEpisodeNav(e.data)
      if (nav && (nav.episode !== episode || nav.season !== season)) {
        syncEpisodeDisplay(nav.season, nav.episode)
      }
      const pb = extractPlayback(e.data, rawId, season, episode)
      if (pb && pb.time > 1) {
        realTimeReported = true
        lastReal = { time: pb.time, duration: pb.duration > 0 ? pb.duration : episodeDuration }
        const now = performance.now()
        if (now - lastRealSave >= 5000) { // throttle to avoid thrashing state every ~250ms
          lastRealSave = now
          updateProgress(show, lastReal.time, lastReal.duration, season, episode, advanceSeason, nextEp)
        }
        return
      }
      if (isEndedEvent(e.data)) {
        updateProgress(show, episodeDuration, episodeDuration, season, episode, advanceSeason, nextEp)
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('message', onMessage)
    if (!document.hidden) start()

    return () => {
      stop()
      // Persist the exact final position (the throttle may have skipped the last update).
      if (realTimeReported && lastReal) updateProgress(show, lastReal.time, lastReal.duration, season, episode, advanceSeason, nextEp)
      else flush()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('message', onMessage)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show._id, season, episode, episodeCount, usingMovora])

  function selectEpisode(s: number, ep: number) {
    manualSelectAt.current = Date.now()
    setSeason(s)
    setEpisode(ep)
    setDisplaySeason(s)
    setDisplayEpisode(ep)
    setIframeKey(k => k + 1)  // force iframe reload even if season/episode unchanged
    // Keep the user on the server they were already using (Movora or Server N) across episode
    // changes — don't reset to Server 1.
    window.history.replaceState(null, '', `/watch/show/${show.slug}?season=${s}&episode=${ep}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Only updates UI highlighter + URL — does NOT reload the iframe (Videasy handles internally)
  function syncEpisodeDisplay(s: number, ep: number) {
    // Ignore if user manually selected an episode within the last 10s
    if (Date.now() - manualSelectAt.current < 10000) return
    setDisplaySeason(s)
    setDisplayEpisode(ep)
    window.history.replaceState(null, '', `/watch/show/${show.slug}?season=${s}&episode=${ep}`)
  }

  function tryNextServer() {
    if (hasNextServer) setActiveServerIdx(i => i + 1)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative lg:pl-24">

      {/* Ambient backdrop */}
      {show.backdropUrl && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <img
            src={show.backdropUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-[0.07] blur-2xl scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        </div>
      )}

      {/* Top bar */}
      <div className="relative z-50 flex items-center gap-3 px-4 sm:px-6 lg:px-8 py-3 lg:py-4 border-b border-white/[0.06] bg-background/80 backdrop-blur-md sticky top-0 pt-[calc(0.75rem_+_env(safe-area-inset-top))]">
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
          {!usingMovora && (
            <span className="text-xs text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-full font-semibold">
              {active.quality}
            </span>
          )}
          <span className="hidden sm:inline text-xs text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full font-medium">
            {usingMovora ? 'Movora Player' : active.serverName}
          </span>
        </div>
      </div>

      {/* ── Player ── */}
      <div className="relative z-10 w-full bg-black lg:max-w-6xl lg:mx-auto lg:px-8 lg:pt-6 lg:bg-transparent">
        <div className="lg:rounded-2xl lg:overflow-hidden lg:ring-1 lg:ring-white/10 lg:shadow-2xl">
          <div className="relative w-full touch-pan-y" style={{ aspectRatio: '16/9' }}>
            <div className="hidden lg:block absolute -inset-1 bg-primary/5 blur-xl -z-10" />
            {usingMovora ? (
              <MovoraStreamPlayer
                tmdb={show.tmdbId.replace(/^tv_/, '')}
                type="tv"
                slug={show.slug}
                season={season}
                episode={episode}
                title={show.title}
                poster={show.backdropUrl || show.posterUrl}
                year={show.releaseYear}
                runtime={show.runtime}
                rating={show.rating}
                synopsis={show.synopsis}
                startAt={savedTimestamp > 60 ? savedTimestamp : undefined}
                onProgress={(t, d) => {
                  const nextEp = episode < episodeCount ? episode + 1 : undefined
                  updateProgress(show, t, d, season, episode, nextEp !== undefined ? season : undefined, nextEp)
                }}
                seasons={seasons.map(s => ({ seasonNumber: s.seasonNumber, episodeCount: s.episodeCount }))}
                onEpisodeChange={selectEpisode}
                onFallback={() => setUsingMovora(false)}
              />
            ) : active.type === 'direct' ? (
              <VideoPlayer
                src={active.url}
                title={`${show.title} S${season}E${episode}`}
                poster={show.backdropUrl || show.posterUrl}
                tmdbId={show.tmdbId.replace(/^tv_/, '')}
                mediaType="tv"
                season={season}
                episode={episode}
                year={show.releaseYear}
                runtime={show.runtime}
                rating={show.rating}
                synopsis={show.synopsis}
                startAt={savedTimestamp > 60 ? savedTimestamp : undefined}
              />
            ) : (
              <>
                <iframe
                  ref={iframeRef}
                  key={`${activeUrl}-${iframeKey}`}
                  src={activeUrl}
                  title={`${show.title} S${season}E${episode} — ${active.serverName}`}
                  allow="autoplay; fullscreen *; encrypted-media; picture-in-picture; accelerometer; gyroscope"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  className="w-full h-full bg-black"
                  style={{ border: 'none', display: 'block' }}
                  onLoad={() => {
                    setTimeout(() => {
                      setPlayerLoaded(true)
                      loadTimers.current.forEach(clearTimeout)
                    }, 800)
                    setShowFallback(false)
                    clearTimeout(fallbackTimer.current)
                  }}
                />
                {!playerLoaded && (
                  <div className="absolute inset-0 z-10 bg-black overflow-hidden flex flex-col">
                    {(show.backdropUrl || show.posterUrl) && (
                      <>
                        <img
                          src={show.backdropUrl || show.posterUrl}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover opacity-50 scale-105"
                          style={{ filter: 'blur(2px)' }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
                      </>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full border-[2.5px] border-white/10 border-t-[#06D6E0] animate-spin" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 sm:px-7 sm:pb-7">
                      <p className="text-white font-semibold text-base sm:text-lg leading-tight mb-1 drop-shadow-lg">
                        {show.title}
                        <span className="text-white/50 font-normal text-sm ml-2">S{season}E{episode}</span>
                      </p>
                      <p className={`text-sm font-medium drop-shadow transition-opacity duration-300 ${
                        loadPhase >= 3 ? 'text-amber-400' : 'text-[#06D6E0]'
                      }`}>
                        {LOAD_MESSAGES[loadPhase].text}
                      </p>
                      {LOAD_MESSAGES[loadPhase].sub && (
                        <p className="text-xs text-white/50 mt-1">
                          {LOAD_MESSAGES[loadPhase].sub}
                          {loadPhase >= 3 && hasNextServer && (
                            <button
                              onClick={tryNextServer}
                              className="ml-2 underline text-white/70 hover:text-white transition-colors"
                            >
                              Try next server
                            </button>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content below player */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 lg:pb-8 space-y-5">

        {/* Server switcher */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Select Server</p>
            {hasNextServer && (
              <button onClick={tryNextServer} className="text-xs text-white/30 hover:text-white/60 font-medium transition-colors">
                Next Server →
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setUsingMovora(true)}
              data-focusable={isTV ? '' : undefined}
              tabIndex={isTV ? 0 : undefined}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                usingMovora
                  ? 'bg-primary text-background shadow-[0_0_20px_rgba(6,214,224,0.3)]'
                  : 'bg-white/5 text-white/55 hover:bg-white/10 hover:text-white border border-white/10 hover:border-primary/30'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${usingMovora ? 'bg-background' : 'bg-white/20'}`} />
              Movora Player
              <span className={`text-[9px] font-bold uppercase tracking-wider ${usingMovora ? 'text-background/70' : 'text-primary'}`}>Premium</span>
            </button>
            {sources.map((src, i) => (
              <button
                key={i}
                onClick={() => { setUsingMovora(false); setActiveServerIdx(i) }}
                data-focusable={isTV ? '' : undefined}
                tabIndex={isTV ? 0 : undefined}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                  !usingMovora && i === activeServerIdx
                    ? 'bg-primary text-background shadow-[0_0_20px_rgba(6,214,224,0.3)]'
                    : 'bg-white/5 text-white/55 hover:bg-white/10 hover:text-white border border-white/10 hover:border-primary/30'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${!usingMovora && i === activeServerIdx ? 'bg-background' : 'bg-white/20'}`} />
                {src.serverName}
              </button>
            ))}
          </div>
          {!usingMovora && activeServerIdx === 0 && (
            <div className="flex items-start gap-2 mb-4 p-3 rounded-xl bg-amber-500/[0.08] border border-amber-500/20">
              <svg className="w-3.5 h-3.5 text-amber-400/80 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              </svg>
              <p className="text-[11px] text-amber-200/70 leading-relaxed">
                If Server 1 does not load, please disable your ad blocker or browser shields, or select another server.
              </p>
            </div>
          )}
          <div className="flex items-start gap-2 pt-3 border-t border-white/[0.05]">
            <svg className="w-3.5 h-3.5 text-white/20 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
            </svg>
            <p className="text-[11px] text-white/25 leading-relaxed">
              Hindi audio may be available on the Movora Player and Server 5 — switch the audio track inside the player. Not all titles have Hindi dubbed content.
            </p>
          </div>
        </div>

        {/* Episode selector */}
        {seasons.length > 0 && (
          <div className="glass rounded-2xl p-5">
            <EpisodeGrid
              show={show}
              currentSeason={displaySeason}
              currentEpisode={displayEpisode}
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
        {show.cast?.length > 0 && (
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

        {children}

      </div>
    </div>
  )
}
