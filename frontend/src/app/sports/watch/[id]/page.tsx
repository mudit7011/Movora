'use client'

import { useEffect, useState, useRef, use, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Hls from 'hls.js'
import Sidebar from '@/components/Sidebar'

const SPORTS_API = '/api/sports'
const STREAMED_REFERER = 'https://streamed.su/'

interface StreamOption {
  embedUrl: string
  hd: boolean
  language?: string
  streamNo?: number
  name?: string
  _referer?: string
  _isEmbed?: boolean  // true = masaladosa/embed iframe; false = direct .m3u8
}

interface Match {
  id: string
  title: string
  category: string
  isLive: boolean
  formattedTime: string
  formattedDate: string
  teams?: { home: { name: string }; away: { name: string } }
  sources: { source: string; id: string }[]
}

const SPORT_EMOJI: Record<string, string> = {
  football: '⚽', cricket: '🏏', basketball: '🏀', tennis: '🎾',
  hockey: '🏒', baseball: '⚾', rugby: '🏉', golf: '⛳',
  'motor-sports': '🏎️', motorsport: '🏎️', fight: '🥊', afl: '🏈',
  darts: '🎯', billiards: '🎱', other: '🏆',
}

function proxyUrl(streamUrl: string, referer = STREAMED_REFERER) {
  return `${SPORTS_API}/proxy?url=${encodeURIComponent(streamUrl)}&referer=${encodeURIComponent(referer)}`
}

function isEmbedUrl(url: string) {
  return url.includes('masaladosa') || url.includes('streammafia') || url.includes('/embed/')
}

export default function SportsWatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const matchId = decodeURIComponent(id)
  const searchParams = useSearchParams()
  const router = useRouter()
  const defaultSource = searchParams.get('source') ?? 'echo'

  const [match, setMatch] = useState<Match | null>(null)
  const [streams, setStreams] = useState<StreamOption[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // HLS player state (only used for direct .m3u8 streams)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const refererRef = useRef<string>(STREAMED_REFERER)
  const [levels, setLevels] = useState<{ index: number; height: number; bitrate: number }[]>([])
  const [currentLevel, setCurrentLevel] = useState(-1)
  const [playerLoading, setPlayerLoading] = useState(true)
  const [playerError, setPlayerError] = useState('')

  // ── Fetch match + streams ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setStreams([])
    setMatch(null)

    async function load() {
      let sources: { source: string; id: string }[] = [{ source: defaultSource, id: matchId }]
      try {
        const eventsRes = await fetch(`${SPORTS_API}/events`)
        const eventsData = await eventsRes.json()
        const found: Match | undefined = (eventsData.events || []).find((m: Match) => m.id === matchId)
        if (!cancelled && found) {
          setMatch(found)
          if (found.sources?.length > 0) sources = found.sources
        }
      } catch { /* proceed with default */ }

      try {
        const results = await Promise.allSettled(
          sources.map(s =>
            fetch(`${SPORTS_API}/stream/${encodeURIComponent(s.source)}/${encodeURIComponent(matchId)}`)
              .then(r => r.ok ? r.json() : { streams: [], referer: STREAMED_REFERER })
              .catch(() => ({ streams: [], referer: STREAMED_REFERER }))
          )
        )
        if (cancelled) return

        const seen = new Set<string>()
        const all: StreamOption[] = results
          .filter((r): r is PromiseFulfilledResult<{ streams: StreamOption[]; referer?: string }> => r.status === 'fulfilled')
          .flatMap(r => (r.value.streams || []).map((s: StreamOption) => ({
            ...s,
            _referer: r.value.referer || STREAMED_REFERER,
            _isEmbed: isEmbedUrl(s.embedUrl || ''),
          })))
          .filter(s => {
            if (!s.embedUrl) return false
            if (seen.has(s.embedUrl)) return false
            seen.add(s.embedUrl)
            return true
          })

        // Prefer HLS streams first, embed streams as fallback
        all.sort((a, b) => Number(a._isEmbed) - Number(b._isEmbed))

        if (all.length === 0) setError('No streams available for this match right now.')
        else { setStreams(all); setActiveIdx(0) }
      } catch {
        if (!cancelled) setError('Failed to load streams.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [matchId, defaultSource])

  // ── HLS.js player ──────────────────────────────────────────────────────────
  const startStream = useCallback((streamUrl: string) => {
    const video = videoRef.current
    if (!video) return

    if (hlsRef.current) {
      try { hlsRef.current.destroy() } catch { /* ignore */ }
      hlsRef.current = null
    }
    setLevels([])
    setCurrentLevel(-1)
    setPlayerLoading(true)
    setPlayerError('')

    const src = proxyUrl(streamUrl, refererRef.current)

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        liveSyncDurationCount: 3,
        backBufferLength: 30,
        xhrSetup: (xhr) => { xhr.withCredentials = false },
      })
      hlsRef.current = hls
      hls.loadSource(src)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLevels(hls.levels.map((l, i) => ({ index: i, height: l.height || 0, bitrate: l.bitrate || 0 })))
        setPlayerLoading(false)
        video.play().catch(() => {})
      })

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => setCurrentLevel(data.level))

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            try { hls.startLoad() } catch { /* ignore */ }
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            try { hls.recoverMediaError() } catch { /* ignore */ }
          } else {
            setPlayerError('Stream unavailable. Try another stream.')
          }
        }
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      video.play().catch(() => {})
      setPlayerLoading(false)
    } else {
      setPlayerError('HLS not supported in this browser.')
    }
  }, [])

  useEffect(() => {
    if (streams.length === 0) return
    const s = streams[activeIdx]
    if (!s || s._isEmbed) return  // embed streams use iframe, not HLS.js
    refererRef.current = s._referer || STREAMED_REFERER
    startStream(s.embedUrl)
    return () => {
      if (hlsRef.current) {
        try { hlsRef.current.destroy() } catch { /* ignore */ }
        hlsRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, streams])

  const switchLevel = (level: number) => {
    if (hlsRef.current) hlsRef.current.currentLevel = level
    setCurrentLevel(level)
  }

  const title = match?.teams
    ? `${match.teams.home.name} vs ${match.teams.away.name}`
    : match?.title ?? 'Live Match'
  const emoji = SPORT_EMOJI[match?.category ?? ''] ?? '🏆'
  const activeStream = streams[activeIdx]

  return (
    <>
      <Sidebar />
      <div className="min-h-screen pb-24 lg:pb-8 pt-[calc(0.75rem_+_env(safe-area-inset-top))] px-4 sm:px-6 lg:pl-28 lg:pr-8">

        {/* Top bar */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.07] transition-all"
          >
            <svg className="w-4 h-4 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base">{emoji}</span>
              <h1 className="text-sm font-semibold text-white/80 truncate">{title}</h1>
              {match?.isLive && (
                <span className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            {match && (
              <p className="text-xs text-white/30 mt-0.5 capitalize">
                {match.category.replace(/-/g, ' ')} · {match.formattedDate}
              </p>
            )}
          </div>
        </div>

        {/* Player */}
        <div
          className="relative w-full rounded-2xl overflow-hidden bg-black border border-white/[0.07]"
          style={{ aspectRatio: '16/9' }}
        >
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-white/40">Loading streams…</p>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="text-3xl">📡</div>
              <p className="text-sm text-white/50 text-center px-8">{error}</p>
              <button onClick={() => router.back()} className="px-4 py-2 rounded-xl bg-white/10 text-sm text-white/60 hover:bg-white/15 transition-all">
                Go back
              </button>
            </div>
          ) : activeStream?._isEmbed ? (
            /* ── Embed (iframe) fallback — masaladosa / cloudflare-protected ── */
            <>
              {playerLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/80 pointer-events-none">
                  <div className="relative">
                    <div className="w-14 h-14 border-2 border-white/5 rounded-full" />
                    <div className="absolute inset-0 w-14 h-14 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center text-xl">{emoji}</div>
                  </div>
                  <p className="text-sm text-white/60">Connecting to stream…</p>
                </div>
              )}
              <iframe
                key={activeStream.embedUrl}
                src={activeStream.embedUrl}
                className="absolute inset-0 w-full h-full"
                allowFullScreen
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                onLoad={() => setPlayerLoading(false)}
              />
            </>
          ) : (
            /* ── Native HLS.js player — direct .m3u8 from streamed.su ── */
            <>
              {playerLoading && !playerError && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/80 pointer-events-none">
                  <div className="relative">
                    <div className="w-14 h-14 border-2 border-white/5 rounded-full" />
                    <div className="absolute inset-0 w-14 h-14 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center text-xl">{emoji}</div>
                  </div>
                  <p className="text-sm text-white/60 font-medium">Connecting to stream…</p>
                  {activeStream && (
                    <p className="text-xs text-white/25">
                      {activeStream.language || (activeStream.hd ? 'HD' : 'SD')} · {activeIdx + 1} / {streams.length}
                    </p>
                  )}
                </div>
              )}

              {playerError && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/90">
                  <div className="text-3xl">📡</div>
                  <p className="text-sm text-white/50 text-center px-8">{playerError}</p>
                  {activeIdx < streams.length - 1 && (
                    <button
                      onClick={() => setActiveIdx(i => i + 1)}
                      className="px-4 py-2 rounded-xl bg-primary/15 border border-primary/30 text-primary text-sm font-semibold"
                    >
                      Try next stream
                    </button>
                  )}
                </div>
              )}

              {levels.length > 1 && !playerLoading && (
                <div className="absolute top-3 right-3 z-20">
                  <select
                    value={currentLevel}
                    onChange={e => switchLevel(Number(e.target.value))}
                    className="bg-black/70 text-white text-xs rounded-lg px-2 py-1 border border-white/10 backdrop-blur-sm cursor-pointer"
                  >
                    <option value={-1}>Auto</option>
                    {[...levels].sort((a, b) => (b.height || 0) - (a.height || 0)).map(l => (
                      <option key={l.index} value={l.index}>
                        {l.height ? `${l.height}p` : `${Math.round((l.bitrate || 0) / 1000)}k`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <video
                ref={videoRef}
                controls
                playsInline
                autoPlay
                className="absolute inset-0 w-full h-full"
                style={{ background: '#000' }}
              />
            </>
          )}
        </div>

        {/* Stream switcher */}
        {streams.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-white/30 font-semibold uppercase tracking-wider mb-2">
              Available Streams
            </p>
            <div className="flex flex-wrap gap-2">
              {streams.map((s, i) => (
                <button
                  key={`${s.embedUrl}-${i}`}
                  onClick={() => { setActiveIdx(i); setPlayerLoading(true); setPlayerError('') }}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    i === activeIdx
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'bg-white/[0.04] text-white/50 border border-white/[0.07] hover:bg-white/[0.08] hover:text-white/70'
                  }`}
                >
                  {s.language || s.name || `Stream ${(s.streamNo ?? i) + 1}`}
                  {s.hd && <span className="ml-1.5 text-[9px] font-bold text-emerald-400/70">HD</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="mt-4 text-[11px] text-white/20 text-center">
          If a stream doesn&apos;t load, try switching to another stream above.
        </p>
      </div>
    </>
  )
}
