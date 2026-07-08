'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

const VideoPlayer = dynamic(() => import('./VideoPlayer'), { ssr: false })

interface StreamSource { server: string; lang: string; url: string; type: 'hls' | 'mp4' | 'dash'; referer?: string }

// MovieBox HD is HEVC DASH. `isTypeSupported` LIES on desktop Chromium (returns true, then fails to
// actually paint frames → audio plays over a stuck poster). HEVC only renders *reliably* on Apple
// (Safari/iOS) and Android — both have real hardware decoders. So we only auto-DEFAULT to MovieBox
// there; on desktop Chromium it stays a one-tap option in the Quality menu (and the player's render
// watchdog fails it over if the user picks it and it still won't decode).
function hevcReliable(): boolean {
  try {
    if (typeof navigator === 'undefined' || typeof MediaSource === 'undefined') return false
    const ua = navigator.userAgent.toLowerCase()
    const isApple = /iphone|ipad|ipod/.test(ua) || (/safari/.test(ua) && !/chrome|crios|chromium|android|edg|fxios/.test(ua))
    const isAndroid = /android/.test(ua)
    return (isApple || isAndroid) && MediaSource.isTypeSupported('video/mp4; codecs="hvc1.1.6.L120.90"')
  } catch { return false }
}
interface EpisodeMeta { episodeNumber: number; name: string; overview: string; stillUrl?: string; runtime?: number }

interface Props {
  tmdb: string
  type: 'movie' | 'tv'
  season?: number
  episode?: number
  title?: string
  poster?: string
  year?: number
  runtime?: number
  rating?: number
  synopsis?: string
  sourceIdx?: number                            // controlled source index (from the bottom pills)
  onSourceIdxChange?: (i: number) => void        // menu/auto-failover changed the source
  onSourcesList?: (labels: string[]) => void     // report the extracted source labels to the parent
  onFallback: () => void
  startAt?: number                                // resume position (seconds)
  onProgress?: (time: number, duration: number) => void   // real playback position → Continue Watching
  seasons?: { seasonNumber: number; episodeCount: number }[]   // TV: for in-player episode list + next-ep
  onEpisodeChange?: (season: number, episode: number) => void   // TV: user picked/advanced an episode
}

// Fixed codenames per backend server (Videasy-style) — never leaks the real scraper name, and is
// STABLE across titles so a given server always reads the same. Order is fixed too: ShowBox first
// (most reliable + full quality ladder), then MovieBox (single HD stream), then vidzee providers.
const SERVER_CODENAMES: Record<string, string> = {
  showbox: 'Nova', moviebox: 'Zenith', nflix: 'Quartz', drag: 'Onyx',
  hindiv2: 'Halo', ipcloud: 'Ember', hindi: 'Halo',
}
const CODENAME_POOL = ['Cobalt', 'Vertex', 'Pulse', 'Flux', 'Orbit', 'Prism', 'Slate', 'Vapor', 'Ridge', 'Cinder']
function codenameFor(server: string): string {
  const key = (server || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  for (const k of Object.keys(SERVER_CODENAMES)) if (key.includes(k)) return SERVER_CODENAMES[k]
  let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return CODENAME_POOL[h % CODENAME_POOL.length]
}
// Display/auto-play order: ShowBox (0) → MovieBox (1) → everything else / vidzee (2).
function serverPriority(server: string): number {
  const s = (server || '').toLowerCase()
  if (s.includes('showbox')) return 0
  if (s.includes('moviebox')) return 1
  return 2
}
// Netflix/Videasy-style second line. MovieBox (Zenith) streams commonly carry several dub tracks
// (switchable in the Audio tab once playing), so advertise that; others name their language, else
// fall back to "Original audio".
function audioSublabel(s: StreamSource): string {
  if (/moviebox/i.test(s.server)) return 'Multiple languages'
  const lang = normLang(`${s.lang} ${s.server}`)
  return lang ? `${lang} audio` : 'Original audio'
}

// Normalize a source's messy lang/server text ("Hindi_v2", "4K · Multi", "Viet") into a
// clean spoken-language name for the Audio menu. Returns '' for multi/unknown (those rely
// on the HLS stream's own embedded audio tracks, which carry proper language names).
function normLang(raw: string): string {
  const s = (raw || '').toLowerCase()
  if (/hindi/.test(s)) return 'Hindi'
  if (/tamil/.test(s)) return 'Tamil'
  if (/telugu/.test(s)) return 'Telugu'
  if (/viet/.test(s)) return 'Vietnamese'
  if (/spanish|espa/.test(s)) return 'Spanish'
  if (/french|fran/.test(s)) return 'French'
  if (/german|deutsch/.test(s)) return 'German'
  if (/arabic/.test(s)) return 'Arabic'
  if (/portug/.test(s)) return 'Portuguese'
  if (/russian/.test(s)) return 'Russian'
  if (/korean/.test(s)) return 'Korean'
  if (/japanese/.test(s)) return 'Japanese'
  if (/italian/.test(s)) return 'Italian'
  if (/chinese|mandarin/.test(s)) return 'Chinese'
  if (/english|\beng\b/.test(s)) return 'English'
  return '' // "Multi", "Original", "Dual", server names → use embedded tracks
}

// Pull a resolution label out of a source's text (ShowBox encodes it as "4K · Multi" etc).
function parseQuality(raw: string): string {
  const s = (raw || '').toLowerCase()
  if (/2160|\b4k\b/.test(s)) return '4K'
  if (/1440/.test(s)) return '1440p'
  if (/1080/.test(s)) return '1080p'
  if (/720/.test(s)) return '720p'
  if (/480/.test(s)) return '480p'
  if (/360/.test(s)) return '360p'
  if (/\borg\b|original/.test(s)) return 'Original'
  return ''
}
// Default-play preference: MovieBox HD (DASH) first *if* the device can decode HEVC (else skip it so
// we don't stall then fail over). Then 1080p H.264 (universally decodable), then the rest. mp4 last.
function playPref(quality: string, type: string, hevcOk: boolean): number {
  if (type === 'dash') return hevcOk ? 7 : -50
  if (type === 'mp4') return -100
  return { '1080p': 6, '720p': 5, '480p': 4, '4K': 3, '1440p': 3, '360p': 2, 'Original': 1 }[quality] ?? 0
}

// Extracts direct m3u8 sources + subtitles and plays them in the premium VideoPlayer.
export default function MovoraStreamPlayer({ tmdb, type, season, episode, title, poster, year, runtime, rating, synopsis, sourceIdx, onSourceIdxChange, onSourcesList, onFallback, startAt, onProgress, seasons, onEpisodeChange }: Props) {
  const [sources, setSources] = useState<StreamSource[] | null>(null)
  const [subs, setSubs] = useState<{ label: string; language: string; url: string; default: boolean }[]>([])
  const [dead, setDead] = useState(false)
  const [episodes, setEpisodes] = useState<EpisodeMeta[]>([])
  const [logo, setLogo] = useState<string | null>(null)
  const [switching, setSwitching] = useState(false)   // episode/season change while player stays mounted
  const startedRef = useRef(false)                     // has the player mounted at least once?

  // Title-treatment logo (like Server 1 shows). Falls back to the text title when unavailable.
  useEffect(() => {
    let cancelled = false
    setLogo(null)
    fetch(`/api/logo?tmdbId=${encodeURIComponent(tmdb)}&type=${type}`)
      .then(r => r.ok ? r.json() : { logo: null })
      .then(d => { if (!cancelled) setLogo(d?.logo || null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [tmdb, type])

  // For TV, grab the whole season's episode list (drives the current-episode overlay AND the
  // in-player episode list + Next Episode button).
  useEffect(() => {
    if (type !== 'tv' || !season) { setEpisodes([]); return }
    let cancelled = false
    fetch(`/api/episodes?tmdbId=${encodeURIComponent(tmdb)}&season=${season}`)
      .then(r => r.ok ? r.json() : [])
      .then((eps: EpisodeMeta[]) => { if (!cancelled) setEpisodes(Array.isArray(eps) ? eps : []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [tmdb, type, season])

  const episodeInfo = useMemo(() => {
    const ep = episodes.find(e => e.episodeNumber === episode)
    return ep ? { title: ep.name, overview: ep.overview } : null
  }, [episodes, episode])

  useEffect(() => {
    let cancelled = false
    // Once the player has mounted, DON'T tear it down on an episode/season change — keep the
    // same <video> element alive so we never drop out of fullscreen (Netflix-style). We just
    // mark it "switching" (shows the buffering overlay) and swap sources in when ready. Only the
    // very first load shows the full loading screen.
    if (startedRef.current) setSwitching(true)
    else { setSources(null); setDead(false) }
    setSubs([])
    const q = new URLSearchParams({ tmdb, type })
    if (type === 'tv' && season && episode) { q.set('season', String(season)); q.set('episode', String(episode)) }

    fetch(`/api/stream?${q.toString()}`)
      .then(r => r.ok ? r.json() : { sources: [] })
      .then(d => {
        if (cancelled) return
        const s = (d.sources || []) as StreamSource[]
        if (!s.length) { setDead(true); onFallback(); return }
        // Order: ShowBox → MovieBox → vidzee (fixed server priority), then best-decodable variant
        // first WITHIN each server. So the player auto-plays ShowBox's best (H.264, decodes on every
        // device), and MovieBox/vidzee are named alternates one tap away.
        const hevcOk = hevcReliable()
        const ordered = [...s].sort((a, b) => {
          const gp = serverPriority(a.server) - serverPriority(b.server)
          if (gp !== 0) return gp
          return playPref(parseQuality(b.lang), b.type, hevcOk) - playPref(parseQuality(a.lang), a.type, hevcOk)
        })
        setSources(ordered)
        startedRef.current = true
        setSwitching(false)
        onSourcesList?.(ordered.map(s => codenameFor(s.server)))
      })
      .catch(() => { if (!cancelled) { setDead(true); onFallback() } })

    fetch(`/api/subtitles/search?${q.toString()}`)
      .then(r => r.ok ? r.json() : { subtitles: [] })
      .then(d => {
        if (cancelled) return
        setSubs((d.subtitles || []).map((x: { display: string; lang: string; id: string }) => ({
          label: x.display, language: x.lang, default: false,
          url: `/api/subtitles/vtt?id=${encodeURIComponent(x.id)}`,
        })))
      })
      .catch(() => {})

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmdb, type, season, episode])

  if (dead) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black text-center px-6">
        <div className="text-3xl">🎬</div>
        <p className="text-sm text-white/50">No direct stream for this title — switching to a server…</p>
      </div>
    )
  }
  if (!sources) {
    return (
      <div className="absolute inset-0 bg-black overflow-hidden">
        {poster && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50 scale-105" style={{ filter: 'blur(2px)' }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
          </>
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-[3px] border-white/10 border-t-[#06D6E0] animate-spin" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 sm:px-7 sm:pb-7">
          {title && <p className="text-white font-semibold text-base sm:text-lg leading-tight mb-1 drop-shadow-lg">{title}</p>}
          <p className="text-sm font-medium text-[#06D6E0] drop-shadow">Finding the best stream…</p>
        </div>
      </div>
    )
  }

  // s.url is already a sealed /api/stream/hls token from the backend (the real CDN url is hidden).
  // label = the server's codename (Nova/Zenith/…), sublabel = the Videasy-style audio line, group =
  // the real server name (used only internally to scope Quality/Audio to the active server).
  const vpSources = sources.map(s => ({
    label: codenameFor(s.server),
    sublabel: audioSublabel(s),
    src: s.url,
    lang: normLang(`${s.lang} ${s.server}`),
    quality: (s.type === 'hls' || s.type === 'dash') ? parseQuality(s.lang) : '',
    group: s.server,
  }))

  return (
    <VideoPlayer
      src={vpSources[0].src}
      sources={vpSources}
      activeSourceIdx={sourceIdx}
      onSourceChange={onSourceIdxChange}
      onSourcesExhausted={onFallback}
      externalSubtitles={subs}
      title={title}
      poster={poster}
      tmdbId={tmdb}
      mediaType={type}
      season={season}
      episode={episode}
      year={year}
      runtime={runtime}
      rating={rating}
      synopsis={synopsis}
      episodeTitle={episodeInfo?.title}
      episodeOverview={episodeInfo?.overview}
      startAt={startAt}
      onProgress={onProgress}
      episodes={episodes}
      seasons={seasons}
      onEpisodeChange={onEpisodeChange}
      titleLogo={logo}
      busy={switching}
    />
  )
}
