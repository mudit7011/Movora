'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

interface QualityLevel { index: number; height: number; bitrate: number }
interface AudioTrack   { id: number; name: string }
interface SubTrack     { id: number; name: string }

interface ExtSubtitle { label: string; language: string; url: string; default: boolean }
interface ParsedCue  { start: number; end: number; text: string }

interface SubPrefs {
  size: 'sm' | 'base' | 'lg' | 'xl' | '2xl'
  color: 'white' | 'yellow' | 'cyan'
  bg: 'glass' | 'dark' | 'none'
  bold: boolean
  shadow: boolean
}
const DEFAULT_SUB_PREFS: SubPrefs = { size: 'lg', color: 'white', bg: 'none', bold: true, shadow: true }
const SUB_PREFS_KEY = 'movora_sub_prefs'

const SUB_PREFS_VERSION = 2
function loadSubPrefs(): SubPrefs {
  try {
    const raw = localStorage.getItem(SUB_PREFS_KEY)
    if (!raw) return DEFAULT_SUB_PREFS
    const parsed = JSON.parse(raw)
    // Reset to default if saved from an older version
    if (parsed._v !== SUB_PREFS_VERSION) return DEFAULT_SUB_PREFS
    return { ...DEFAULT_SUB_PREFS, ...parsed }
  } catch { return DEFAULT_SUB_PREFS }
}

function parseVTT(vtt: string): ParsedCue[] {
  const cues: ParsedCue[] = []
  const toSec = (s: string) => {
    const p = s.trim().split(':')
    return p.length === 3
      ? +p[0] * 3600 + +p[1] * 60 + parseFloat(p[2])
      : +p[0] * 60 + parseFloat(p[1])
  }
  for (const block of vtt.split(/\n\n+/)) {
    const lines = block.trim().split('\n')
    const ti = lines.findIndex(l => l.includes('-->'))
    if (ti < 0) continue
    const [s, e] = lines[ti].split('-->')
    const text = lines.slice(ti + 1).join('\n').replace(/<[^>]*>/g, '').trim()
    if (text) cues.push({ start: toSec(s), end: toSec(e), text })
  }
  return cues
}

function srtToVtt(srt: string): string {
  return 'WEBVTT\n\n' + srt
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
    .replace(/^\d+\s*\n/gm, '')                                // strip index numbers
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')         // comma → dot in timestamps
}

interface Props {
  src: string       // .m3u8 or .mp4 direct URL
  title?: string
  poster?: string
  externalSubtitles?: ExtSubtitle[]
  startAt?: number
  tmdbId?: string
  mediaType?: 'movie' | 'tv'
  season?: number
  episode?: number
}

function fmt(s: number) {
  if (!isFinite(s)) return '0:00'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`
}

interface OSResult {
  fileId: number
  fileName: string
  language: string
  langName: string
  downloads: number
  rating: number
  release: string
  hearing: boolean
}

type Menu = 'quality' | 'audio' | 'sub' | 'speed' | 'subprefs' | 'ossearch' | null

export default function VideoPlayer({ src, title, poster, externalSubtitles, startAt, tmdbId, mediaType = 'movie', season, episode }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const wrapRef    = useRef<HTMLDivElement>(null)
  const seekRef    = useRef<HTMLDivElement>(null)
  const hideTimer  = useRef<ReturnType<typeof setTimeout>>()
  const hlsRef     = useRef<any>(null)

  const [playing,   setPlaying]   = useState(false)
  const [current,   setCurrent]   = useState(0)
  const [duration,  setDuration]  = useState(0)
  const [buffered,  setBuffered]  = useState(0)
  const [volume,    setVolume]    = useState(1)
  const [muted,     setMuted]     = useState(false)
  const [fs,        setFs]        = useState(false)
  const [showCtrl,  setShowCtrl]  = useState(true)
  const [hoverPct,  setHoverPct]  = useState<number | null>(null)

  const [qualities,    setQualities]    = useState<QualityLevel[]>([])
  const [curQuality,   setCurQuality]   = useState(-1)
  const [audioTracks,  setAudioTracks]  = useState<AudioTrack[]>([])
  const [curAudio,     setCurAudio]     = useState(-1)
  const [subTracks,    setSubTracks]    = useState<SubTrack[]>([])
  const [curSub,       setCurSub]       = useState(-1)
  const [speed,        setSpeed]        = useState(1)
  const [openMenu,     setOpenMenu]     = useState<Menu>(null)
  const [loading,      setLoading]      = useState(true)
  const [curExtSub,    setCurExtSub]    = useState<number>(-1)  // always off by default
  const [currentCue,   setCurrentCue]   = useState<string>('')
  const parsedCuesRef      = useRef<ParsedCue[]>([])
  const hlsSubVidTrackRef  = useRef<number>(-1)
  const [localSubs,        setLocalSubs]    = useState<ExtSubtitle[]>([])
  const fileInputRef       = useRef<HTMLInputElement>(null)
  const blobUrlsRef        = useRef<string[]>([])  // track blob URLs for cleanup

  // Combine API subs + locally uploaded subs
  const allExtSubs = [...(externalSubtitles ?? []), ...localSubs]

  // OpenSubtitles search state
  const [osResults,   setOsResults]   = useState<OSResult[]>([])
  const [osLoading,   setOsLoading]   = useState(false)
  const [osError,     setOsError]     = useState<string | null>(null)
  const [osSearched,  setOsSearched]  = useState(false)
  const [osLang,      setOsLang]      = useState('en')

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => { blobUrlsRef.current.forEach(u => URL.revokeObjectURL(u)) }
  }, [])
  const [subPrefs,     setSubPrefs]     = useState<SubPrefs>(DEFAULT_SUB_PREFS)

  // Load subtitle prefs from localStorage on mount
  useEffect(() => { setSubPrefs(loadSubPrefs()) }, [])
  // Persist whenever they change
  useEffect(() => {
    try { localStorage.setItem(SUB_PREFS_KEY, JSON.stringify({ ...subPrefs, _v: SUB_PREFS_VERSION })) } catch {}
  }, [subPrefs])

  // Load + parse VTT whenever selected subtitle changes
  useEffect(() => {
    parsedCuesRef.current = []
    setCurrentCue('')
    const sub = allExtSubs[curExtSub]
    if (curExtSub < 0 || !sub) return
    fetch(sub.url)
      .then(r => r.text())
      .then(txt => { parsedCuesRef.current = parseVTT(txt) })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curExtSub, externalSubtitles, localSubs])


  // ── HLS init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    async function init() {
      setLoading(true)
      const isHls = src.includes('.m3u8') || src.includes('/hls/') || src.includes('master')

      if (isHls) {
        const Hls = (await import('hls.js')).default
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true })
          hlsRef.current = hls
          hls.loadSource(src)
          hls.attachMedia(video!)

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            const lvls = hls.levels.map((l: any, i: number) => ({
              index: i, height: l.height || 0, bitrate: l.bitrate || 0,
            }))
            setQualities(lvls)
            if (startAt && startAt > 0) video!.currentTime = startAt
            hls.subtitleTrack = -1  // disable any DEFAULT HLS subtitle track
          })

          hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_: any, d: any) => {
            setAudioTracks(d.audioTracks.map((t: any) => ({ id: t.id, name: t.name })))
            setCurAudio(hls.audioTrack)
          })

          hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_: any, d: any) => {
            setSubTracks(d.subtitleTracks.map((t: any) => ({ id: t.id, name: t.name })))
            hls.subtitleTrack = -1  // ensure off by default
          })
        } else if (video!.canPlayType('application/vnd.apple.mpegurl')) {
          video!.src = src
        }
      } else {
        video!.src = src
      }
    }

    init()
    return () => { hlsRef.current?.destroy(); hlsRef.current = null }
  }, [src])

  // ── Video events ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onPlay       = () => setPlaying(true)
    const onPause      = () => setPlaying(false)
    const onWaiting    = () => setLoading(true)
    const onCanPlay    = () => setLoading(false)
    const onTimeUpdate = () => {
      if (!v) return
      setCurrent(v.currentTime)
      if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1))
      const t = v.currentTime
      // External VTT cues (ezvidapi)
      if (parsedCuesRef.current.length > 0) {
        const cue = parsedCuesRef.current.find(c => t >= c.start && t <= c.end)
        setCurrentCue(cue?.text ?? '')
      } else if (hlsSubVidTrackRef.current >= 0) {
        // HLS manifest subtitle cues
        const track = v.textTracks[hlsSubVidTrackRef.current]
        const cues = track?.activeCues
        setCurrentCue(cues?.length ? (cues[0] as VTTCue).text.replace(/<[^>]*>/g, '') : '')
      } else {
        setCurrentCue('')
      }
    }
    const onDuration   = () => { if (v) setDuration(v.duration) }
    const onVolume     = () => { if (v) { setVolume(v.volume); setMuted(v.muted) } }

    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('waiting', onWaiting)
    v.addEventListener('canplay', onCanPlay)
    v.addEventListener('timeupdate', onTimeUpdate)
    v.addEventListener('durationchange', onDuration)
    v.addEventListener('volumechange', onVolume)

    return () => {
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('waiting', onWaiting)
      v.removeEventListener('canplay', onCanPlay)
      v.removeEventListener('timeupdate', onTimeUpdate)
      v.removeEventListener('durationchange', onDuration)
      v.removeEventListener('volumechange', onVolume)
    }
  }, [])

  // ── Fullscreen change ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fn = () => {
      const v = videoRef.current as HTMLVideoElement & { webkitDisplayingFullscreen?: boolean }
      setFs(!!(document.fullscreenElement || v?.webkitDisplayingFullscreen))
    }
    document.addEventListener('fullscreenchange', fn)
    document.addEventListener('webkitfullscreenchange', fn)
    videoRef.current?.addEventListener('webkitbeginfullscreen', fn)
    videoRef.current?.addEventListener('webkitendfullscreen', fn)
    return () => {
      document.removeEventListener('fullscreenchange', fn)
      document.removeEventListener('webkitfullscreenchange', fn)
      videoRef.current?.removeEventListener('webkitbeginfullscreen', fn)
      videoRef.current?.removeEventListener('webkitendfullscreen', fn)
    }
  }, [])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const v = videoRef.current
      if (!v) return
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); v.paused ? v.play() : v.pause(); break
        case 'f': toggleFs(); break
        case 'm': v.muted = !v.muted; break
        case 'ArrowRight': v.currentTime = Math.min(v.currentTime + 10, v.duration); break
        case 'ArrowLeft':  v.currentTime = Math.max(v.currentTime - 10, 0); break
        case 'ArrowUp':    v.volume = Math.min(v.volume + 0.1, 1); break
        case 'ArrowDown':  v.volume = Math.max(v.volume - 0.1, 0); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Auto-hide controls ────────────────────────────────────────────────────────
  const resetHide = useCallback(() => {
    setShowCtrl(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      const v = videoRef.current
      if (v && !v.paused) { setShowCtrl(false); setOpenMenu(null) }
    }, 3500)
  }, [])

  // ── Actions ───────────────────────────────────────────────────────────────────
  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    v.paused ? v.play() : v.pause()
  }

  function toggleFs() {
    const wrap = wrapRef.current
    const v = videoRef.current as HTMLVideoElement & { webkitEnterFullscreen?: () => void; webkitExitFullscreen?: () => void; webkitDisplayingFullscreen?: boolean }
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else if ((document as Document & { webkitExitFullscreen?: () => void }).webkitExitFullscreen && v?.webkitDisplayingFullscreen) {
      v.webkitExitFullscreen?.()
    } else if (wrap?.requestFullscreen) {
      wrap.requestFullscreen()
    } else if (v?.webkitEnterFullscreen) {
      v.webkitEnterFullscreen()
    }
  }

  function getPct(e: React.MouseEvent) {
    const bar = seekRef.current
    if (!bar || !duration) return 0
    const rect = bar.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  }

  function onSeekClick(e: React.MouseEvent) {
    const v = videoRef.current
    if (!v) return
    v.currentTime = getPct(e) * duration
  }

  function setQuality(idx: number) {
    if (hlsRef.current) hlsRef.current.currentLevel = idx
    setCurQuality(idx)
    setOpenMenu(null)
  }

  function setAudio(id: number) {
    if (hlsRef.current) hlsRef.current.audioTrack = id
    setCurAudio(id)
    setOpenMenu(null)
  }

  function setSub(id: number) {
    const hls = hlsRef.current
    const video = videoRef.current
    hlsSubVidTrackRef.current = -1
    if (id >= 0 && hls && video) {
      hls.subtitleTrack = id
      // Find matching TextTrack in video by label — set hidden so we render cues manually
      const targetName = hls.subtitleTracks?.[id]?.name ?? ''
      setTimeout(() => {
        const tracks = video.textTracks
        for (let i = 0; i < tracks.length; i++) {
          if (tracks[i].label === targetName || tracks[i].language === (hls.subtitleTracks?.[id]?.lang ?? '')) {
            tracks[i].mode = 'hidden'
            hlsSubVidTrackRef.current = i
            break
          }
        }
      }, 200)  // small delay so hls.js can attach the track
    } else if (hls) {
      hls.subtitleTrack = -1
      setCurrentCue('')
    }
    setCurSub(id)
    setOpenMenu(null)
  }

  function setPlaySpeed(s: number) {
    if (videoRef.current) videoRef.current.playbackRate = s
    setSpeed(s)
    setOpenMenu(null)
  }

  function setExtSub(idx: number) {
    setCurExtSub(idx)
    if (idx < 0) { parsedCuesRef.current = []; setCurrentCue('') }
    setOpenMenu(null)
  }

  function handleSubFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = ev => {
      let text = ev.target?.result as string
      if (file.name.endsWith('.srt')) text = srtToVtt(text)
      const blob = new Blob([text], { type: 'text/vtt' })
      const url  = URL.createObjectURL(blob)
      blobUrlsRef.current.push(url)
      const newSub: ExtSubtitle = { label: `📁 ${file.name}`, language: 'custom', url, default: false }
      setLocalSubs(prev => {
        const next = [...prev, newSub]
        // Auto-select the newly uploaded subtitle
        setCurExtSub((externalSubtitles?.length ?? 0) + next.length - 1)
        return next
      })
      setOpenMenu(null)
    }
    reader.readAsText(file)
  }

  async function searchOpenSubtitles(lang: string) {
    if (!tmdbId) return
    setOsLoading(true)
    setOsError(null)
    setOsSearched(false)
    try {
      const params = new URLSearchParams({ tmdbId, type: mediaType, languages: lang })
      if (season)  params.set('season',  String(season))
      if (episode) params.set('episode', String(episode))
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/subtitles/search?${params}`)
      if (!res.ok) throw new Error('Search failed')
      const data: OSResult[] = await res.json()
      setOsResults(data)
      setOsSearched(true)
    } catch {
      setOsError('Search failed. Check your connection.')
    } finally {
      setOsLoading(false)
    }
  }

  async function pickOsSubtitle(result: OSResult) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/subtitles/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: result.fileId }),
      })
      if (!res.ok) throw new Error()
      let text = await res.text()
      if (!text.startsWith('WEBVTT')) text = srtToVtt(text)
      const blob = new Blob([text], { type: 'text/vtt' })
      const url = URL.createObjectURL(blob)
      blobUrlsRef.current.push(url)
      const langLabel = result.hearing ? `${result.langName} [SDH]` : result.langName
      const newSub: ExtSubtitle = { label: `🌐 ${langLabel}`, language: result.language, url, default: false }
      setLocalSubs(prev => {
        const next = [...prev, newSub]
        setCurExtSub((externalSubtitles?.length ?? 0) + next.length - 1)
        return next
      })
      setOpenMenu(null)
    } catch {
      setOsError('Failed to load subtitle. Try another.')
    }
  }

  const progress    = duration > 0 ? (current / duration) * 100 : 0
  const bufPct      = duration > 0 ? (buffered / duration) * 100 : 0
  const qualLabel   = curQuality === -1 ? 'Auto' : (qualities[curQuality]?.height > 0 ? `${qualities[curQuality].height}p` : 'Auto')
  const ctrlVisible = showCtrl || !playing

  const hasCC = allExtSubs.length > 0 || subTracks.length > 0 || !!tmdbId

  const subBgClass = subPrefs.bg === 'glass'
    ? 'bg-white/10 backdrop-blur-xl backdrop-saturate-150 border border-white/20 shadow-[0_4px_24px_rgba(0,0,0,0.4)]'
    : subPrefs.bg === 'dark'
    ? 'bg-black/60 backdrop-blur-sm border border-white/10'
    : 'bg-transparent border-transparent'
  const subTextClass = [
    subPrefs.size === 'sm'  ? 'text-[10px] sm:text-sm'      :
    subPrefs.size === 'base'? 'text-xs sm:text-base'         :
    subPrefs.size === 'lg'  ? 'text-sm sm:text-lg'           :
    subPrefs.size === 'xl'  ? 'text-sm sm:text-xl'           : 'text-base sm:text-2xl',
    subPrefs.color === 'yellow' ? 'text-yellow-300' :
    subPrefs.color === 'cyan'   ? 'text-[#06D6E0]'  : 'text-white',
    subPrefs.bold   ? 'font-bold' : 'font-medium',
    subPrefs.shadow ? '[text-shadow:0_1px_4px_rgba(0,0,0,1),0_0_8px_rgba(0,0,0,0.9),1px_1px_0_rgba(0,0,0,0.7),-1px_-1px_0_rgba(0,0,0,0.7)]' : '',
  ].join(' ')

  return (
    <div
      ref={wrapRef}
      className="relative bg-black w-full h-full select-none overflow-hidden group/player"
      onMouseMove={resetHide}
      onMouseLeave={() => { if (playing) setShowCtrl(false) }}
    >
      {/* Video */}
      <video ref={videoRef} className="w-full h-full object-contain" poster={poster} playsInline onClick={togglePlay} />

      {/* Loading spinner */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-14 h-14 rounded-full border-[3px] border-white/10 border-t-[#06D6E0] animate-spin" />
        </div>
      )}

      {/* ── Netflix-style overlays ── */}

      {/* Top gradient + title bar */}
      <div className={`absolute inset-x-0 top-0 z-10 transition-opacity duration-300 ${ctrlVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="h-32 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />
        {title && (
          <div className="absolute top-0 inset-x-0 flex items-center px-5 pt-4">
            <p className="text-white font-semibold text-base drop-shadow-lg line-clamp-1">{title}</p>
          </div>
        )}
      </div>

      {/* Subtitle — always visible, sits above controls */}
      {currentCue && (
        <div
          className={`absolute inset-x-0 z-20 pointer-events-none flex justify-center px-3 transition-all duration-200 ${ctrlVisible ? 'bottom-[90px] sm:bottom-[108px]' : 'bottom-6 sm:bottom-10'}`}
        >
          <span className={`${subBgClass} ${subTextClass} px-2 py-1 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl leading-snug text-center w-full sm:max-w-[80%] whitespace-pre-line`}>
            {currentCue}
          </span>
        </div>
      )}

      {/* Bottom gradient + controls */}
      <div
        className={`absolute inset-x-0 bottom-0 transition-opacity duration-300 ${ctrlVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Gradient backdrop — absolute so controls sit on top of it */}
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black via-black/75 to-transparent pointer-events-none" />

        <div className="relative z-10 px-3 sm:px-5 pb-3 sm:pb-5 pt-1 sm:pt-2 space-y-1 sm:space-y-2">
          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div
              ref={seekRef}
              className="relative flex-1 h-1 hover:h-[5px] bg-white/20 rounded-full cursor-pointer transition-all duration-150 group/seek"
              onClick={onSeekClick}
              onMouseMove={e => setHoverPct(getPct(e))}
              onMouseLeave={() => setHoverPct(null)}
            >
              <div className="absolute inset-y-0 left-0 bg-white/20 rounded-full" style={{ width: `${bufPct}%` }} />
              <div className="absolute inset-y-0 left-0 bg-[#06D6E0] rounded-full" style={{ width: `${progress}%` }} />
              <div
                className="absolute top-1/2 w-4 h-4 -translate-y-1/2 -translate-x-1/2 bg-white rounded-full shadow-xl scale-0 group-hover/seek:scale-100 transition-transform"
                style={{ left: `${progress}%` }}
              />
              {hoverPct !== null && duration > 0 && (
                <div
                  className="absolute -top-9 -translate-x-1/2 bg-black/90 backdrop-blur text-white text-xs px-2.5 py-1 rounded-lg pointer-events-none whitespace-nowrap font-medium"
                  style={{ left: `${hoverPct * 100}%` }}
                >
                  {fmt(hoverPct * duration)}
                </div>
              )}
            </div>
            <span className="text-white/60 text-xs font-mono whitespace-nowrap flex-shrink-0">
              {fmt(current)} / {fmt(duration)}
            </span>
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-1">

            {/* Play/Pause */}
            <button onClick={togglePlay} className="p-2 text-white hover:text-[#06D6E0] transition-colors">
              {playing ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="5" y="3" width="4" height="18" rx="1.5"/><rect x="15" y="3" width="4" height="18" rx="1.5"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 4.5v15L20 12 7 4.5z"/>
                </svg>
              )}
            </button>

            {/* Skip -10 */}
            <button onClick={() => { if (videoRef.current) videoRef.current.currentTime -= 10 }} className="p-2 text-white/70 hover:text-white transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.5 3a9 9 0 1 0 7.56 4.11L18.4 8.77A7 7 0 1 1 12.5 5V8l-4-4 4-4v3z"/>
                <text x="8.5" y="16" fontSize="5.5" fontWeight="bold" fontFamily="sans-serif">10</text>
              </svg>
            </button>

            {/* Skip +10 */}
            <button onClick={() => { if (videoRef.current) videoRef.current.currentTime += 10 }} className="p-2 text-white/70 hover:text-white transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.5 3a9 9 0 1 1-7.56 4.11L5.6 8.77A7 7 0 1 0 11.5 5V8l4-4-4-4v3z"/>
                <text x="8.5" y="16" fontSize="5.5" fontWeight="bold" fontFamily="sans-serif">10</text>
              </svg>
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1 group/vol">
              <button onClick={() => { if (videoRef.current) videoRef.current.muted = !muted }} className="p-2 text-white/70 hover:text-white transition-colors">
                {muted || volume === 0 ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                ) : volume < 0.5 ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                )}
              </button>
              <div className="overflow-hidden w-0 group-hover/vol:w-20 transition-all duration-200 flex items-center">
                <input type="range" min="0" max="1" step="0.02" value={muted ? 0 : volume}
                  onChange={e => { const v = parseFloat(e.target.value); if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0 } }}
                  className="w-20 h-1 cursor-pointer accent-[#06D6E0] rounded-full flex-shrink-0"
                />
              </div>
            </div>

            <div className="flex-1" />

            {/* Speed */}
            <div className="relative">
              <button onClick={() => setOpenMenu(openMenu === 'speed' ? null : 'speed')}
                className="p-2 text-white/60 hover:text-white text-xs font-bold transition-colors">
                {speed}×
              </button>
              {openMenu === 'speed' && (
                <Menu label="Speed" onClose={() => setOpenMenu(null)}>
                  {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(s => (
                    <MenuItem key={s} active={speed === s} onClick={() => setPlaySpeed(s)}>{s === 1 ? 'Normal' : `${s}×`}</MenuItem>
                  ))}
                </Menu>
              )}
            </div>

            {/* CC */}
            {hasCC && (
              <div className="relative">
                <button onClick={() => setOpenMenu(openMenu === 'sub' ? null : 'sub')}
                  className={`p-2 text-xs font-bold px-2 py-0.5 rounded border transition-colors ${
                    (curExtSub >= 0 || curSub >= 0)
                      ? 'text-[#06D6E0] border-[#06D6E0]/50 bg-[#06D6E0]/10'
                      : 'text-white/60 border-white/20 hover:text-white'
                  }`}
                >
                  CC
                </button>
                {openMenu === 'sub' && (
                  <Menu label="Subtitles" onClose={() => setOpenMenu(null)}>
                    {allExtSubs.length > 0 ? (
                      <>
                        <MenuItem active={curExtSub === -1} onClick={() => setExtSub(-1)}>Off</MenuItem>
                        {allExtSubs.map((s, i) => (
                          <MenuItem key={i} active={curExtSub === i} onClick={() => setExtSub(i)}>{s.label}</MenuItem>
                        ))}
                      </>
                    ) : (
                      <>
                        <MenuItem active={curSub === -1} onClick={() => setSub(-1)}>Off</MenuItem>
                        {subTracks.map(t => (
                          <MenuItem key={t.id} active={curSub === t.id} onClick={() => setSub(t.id)}>{t.name}</MenuItem>
                        ))}
                      </>
                    )}
                    <div className="mx-3 my-1.5 border-t border-white/10 flex-shrink-0" />
                    <button
                      onClick={() => { fileInputRef.current?.click(); setOpenMenu(null) }}
                      className="w-full text-left px-4 py-2 text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      <span>📁</span> Upload (.srt / .vtt)
                    </button>
                    {tmdbId && (
                      <button
                        onClick={() => { setOsResults([]); setOsSearched(false); setOsError(null); setOpenMenu('ossearch') }}
                        className="w-full text-left px-4 py-2 text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                      >
                        <span>🔍</span> Search OpenSubtitles
                      </button>
                    )}
                  </Menu>
                )}
              </div>
            )}

            {/* Subtitle preferences */}
            {hasCC && (
              <div className="relative">
                <button
                  onClick={() => setOpenMenu(openMenu === 'subprefs' ? null : 'subprefs')}
                  className={`p-2 text-xs font-bold transition-colors ${openMenu === 'subprefs' ? 'text-[#06D6E0]' : 'text-white/50 hover:text-white'}`}
                  title="Subtitle style"
                >
                  Aa
                </button>
                {openMenu === 'subprefs' && (
                  <>
                  <div className="fixed inset-0 z-40" onPointerDown={e => { e.stopPropagation(); setOpenMenu(null) }} />
                  <div className="absolute bottom-10 right-0 z-50 w-64 bg-[#111]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-4 space-y-4">
                    <p className="text-[10px] text-white/30 uppercase tracking-widest">Subtitle Style</p>

                    {/* Size */}
                    <div>
                      <p className="text-xs text-white/50 mb-1.5">Size</p>
                      <div className="flex gap-1.5">
                        {(['sm','base','lg','xl','2xl'] as const).map(s => (
                          <button key={s} onClick={() => setSubPrefs(p => ({...p, size: s}))}
                            className={`flex-1 py-1 rounded-lg text-xs font-semibold transition-colors ${subPrefs.size === s ? 'bg-[#06D6E0] text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                            {s === 'sm' ? 'XS' : s === 'base' ? 'S' : s === 'lg' ? 'M' : s === 'xl' ? 'L' : 'XL'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Color */}
                    <div>
                      <p className="text-xs text-white/50 mb-1.5">Color</p>
                      <div className="flex gap-2">
                        {([['white','#FFFFFF'],['yellow','#FDE047'],['cyan','#06D6E0']] as const).map(([c, hex]) => (
                          <button key={c} onClick={() => setSubPrefs(p => ({...p, color: c}))}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition-colors ${subPrefs.color === c ? 'bg-white/20 ring-1 ring-white/40' : 'bg-white/5 hover:bg-white/15'}`}>
                            <span className="w-3 h-3 rounded-full border border-white/20 flex-shrink-0" style={{background: hex}} />
                            <span className="text-white/70 capitalize">{c}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Background */}
                    <div>
                      <p className="text-xs text-white/50 mb-1.5">Background</p>
                      <div className="flex gap-1.5">
                        {([['glass','Glass'],['dark','Dark'],['none','None']] as const).map(([b, label]) => (
                          <button key={b} onClick={() => setSubPrefs(p => ({...p, bg: b}))}
                            className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${subPrefs.bg === b ? 'bg-[#06D6E0] text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Toggles */}
                    <div className="flex gap-3">
                      <button onClick={() => setSubPrefs(p => ({...p, bold: !p.bold}))}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${subPrefs.bold ? 'bg-[#06D6E0] text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                        Bold
                      </button>
                      <button onClick={() => setSubPrefs(p => ({...p, shadow: !p.shadow}))}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${subPrefs.shadow ? 'bg-[#06D6E0] text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                        Shadow
                      </button>
                      <button onClick={() => setSubPrefs(DEFAULT_SUB_PREFS)}
                        className="flex-1 py-1.5 rounded-lg text-xs text-white/40 bg-white/5 hover:bg-white/10 transition-colors">
                        Reset
                      </button>
                    </div>
                  </div>
                  </>
                )}
              </div>
            )}

            {/* Audio */}
            {audioTracks.length > 1 && (
              <div className="relative">
                <button onClick={() => setOpenMenu(openMenu === 'audio' ? null : 'audio')}
                  className="p-2 text-white/60 hover:text-white transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                  </svg>
                </button>
                {openMenu === 'audio' && (
                  <Menu label="Audio" onClose={() => setOpenMenu(null)}>
                    {audioTracks.map(t => (
                      <MenuItem key={t.id} active={curAudio === t.id} onClick={() => setAudio(t.id)}>{t.name}</MenuItem>
                    ))}
                  </Menu>
                )}
              </div>
            )}

            {/* Quality */}
            <div className="relative">
              <button onClick={() => setOpenMenu(openMenu === 'quality' ? null : 'quality')}
                className="p-2 text-white/60 hover:text-white text-xs font-semibold transition-colors min-w-[44px] text-center">
                {qualLabel}
              </button>
              {openMenu === 'quality' && (
                <Menu label="Quality" onClose={() => setOpenMenu(null)}>
                  <MenuItem active={curQuality === -1} onClick={() => setQuality(-1)}>Auto</MenuItem>
                  {[...qualities].reverse().map(q => (
                    <MenuItem key={q.index} active={curQuality === q.index} onClick={() => setQuality(q.index)}>
                      {q.height > 0 ? `${q.height}p` : `Level ${q.index}`}
                    </MenuItem>
                  ))}
                </Menu>
              )}
            </div>

            {/* PiP */}
            <button onClick={async () => { const v = videoRef.current; if (!v) return; try { document.pictureInPictureElement ? await document.exitPictureInPicture() : await v.requestPictureInPicture() } catch {} }}
              className="p-2 text-white/60 hover:text-white transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/><rect x="12" y="11" width="9" height="6" rx="1" fill="currentColor" stroke="none"/>
              </svg>
            </button>

            {/* Fullscreen */}
            <button onClick={toggleFs} className="p-2 text-white/60 hover:text-white transition-colors">
              {fs ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
      {/* OpenSubtitles in-player search panel */}
      {openMenu === 'ossearch' && (
        <>
          <div className="fixed inset-0 z-40" onPointerDown={() => setOpenMenu(null)} />
          <div className="absolute inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-xl">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 flex-shrink-0">
              <button onClick={() => setOpenMenu(null)} className="text-white/60 hover:text-white transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className="text-sm font-semibold text-white">Search OpenSubtitles</span>
            </div>

            {/* Language + Search */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 flex-shrink-0">
              <select
                value={osLang}
                onChange={e => setOsLang(e.target.value)}
                className="bg-white/10 border border-white/20 text-white/80 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#06D6E0]/60"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="fr">French</option>
                <option value="es">Spanish</option>
                <option value="de">German</option>
                <option value="ar">Arabic</option>
                <option value="pt">Portuguese</option>
                <option value="ru">Russian</option>
                <option value="zh-CN">Chinese (Simplified)</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
                <option value="it">Italian</option>
              </select>
              <button
                onClick={() => searchOpenSubtitles(osLang)}
                disabled={osLoading}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-[#06D6E0] text-black hover:bg-[#06D6E0]/80 disabled:opacity-50 transition-colors"
              >
                {osLoading ? 'Searching…' : 'Search'}
              </button>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
              {osError && (
                <p className="text-red-400 text-xs text-center py-6 px-4">{osError}</p>
              )}
              {!osLoading && osSearched && osResults.length === 0 && !osError && (
                <p className="text-white/30 text-xs text-center py-6">No subtitles found</p>
              )}
              {!osSearched && !osLoading && !osError && (
                <p className="text-white/20 text-xs text-center py-8">Select language and press Search</p>
              )}
              {osResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => pickOsSubtitle(r)}
                  className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white/90 text-xs truncate flex-1">{r.release || r.fileName}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {r.hearing && <span className="text-[9px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1 rounded">SDH</span>}
                      <span className="text-[9px] bg-white/10 text-white/50 border border-white/10 px-1.5 py-0.5 rounded uppercase">{r.language}</span>
                    </div>
                  </div>
                  {r.downloads > 0 && (
                    <p className="text-white/30 text-[10px] mt-0.5">↓ {r.downloads.toLocaleString()} downloads</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".srt,.vtt"
        className="hidden"
        onChange={handleSubFile}
      />
    </div>
  )
}

// ── Small helper components ────────────────────────────────────────────────────

function Menu({ label, children, onClose }: { label: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      {/* Click-outside backdrop */}
      <div className="fixed inset-0 z-40" onPointerDown={e => { e.stopPropagation(); onClose() }} />
      <div className="absolute bottom-10 right-0 z-50 bg-[#111]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl min-w-[150px] flex flex-col overflow-hidden">
        <p className="text-[10px] text-white/30 uppercase tracking-widest px-4 pt-3 pb-1 flex-shrink-0">{label}</p>
        <div className="overflow-y-auto max-h-[220px] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
          {children}
        </div>
        <div className="h-2 flex-shrink-0" />
      </div>
    </>
  )
}

function MenuItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between w-full text-left px-4 py-2 text-sm transition-colors hover:bg-white/10 ${active ? 'text-[#06D6E0] font-semibold' : 'text-white/70'}`}
    >
      {children}
      {active && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  )
}
