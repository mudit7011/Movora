'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

const VideoPlayer = dynamic(() => import('./VideoPlayer'), { ssr: false })

interface StreamSource { server: string; lang: string; url: string; type: 'hls' | 'mp4'; referer?: string }
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

const labelOf = (s: StreamSource) => `${s.server}${s.lang && s.lang !== 'Original' ? ` · ${s.lang}` : ''}`

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
// Default-play preference: 1080p H.264 is the sweet spot — universally decodable, unlike
// 4K (usually HEVC/HDR that Chrome can't play). mp4/mkv direct files rank lowest.
function playPref(quality: string, type: string): number {
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
        // Order by default-play preference (1080p H.264 first) so the player starts on a
        // stream that actually decodes; higher/other options remain available in the menus.
        const ordered = [...s].sort((a, b) => playPref(parseQuality(b.lang), b.type) - playPref(parseQuality(a.lang), a.type))
        setSources(ordered)
        startedRef.current = true
        setSwitching(false)
        onSourcesList?.(ordered.map(labelOf))
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

  // Only HLS streams get a quality tag (the Quality menu switches between them). Raw ORG
  // mp4/mkv files are excluded — they often won't decode in-browser and would clutter the list.
  // s.url is already a sealed /api/stream/hls token from the backend (the real CDN url is hidden).
  const vpSources = sources.map(s => ({ label: labelOf(s), src: s.url, lang: normLang(`${s.lang} ${s.server}`), quality: s.type === 'hls' ? parseQuality(s.lang) : '' }))

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
