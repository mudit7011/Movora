'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

// True on phone-width screens — menus become body-portaled bottom sheets there so the player's
// overflow-clip and stacking context can't hide/clip them. Desktop keeps anchored dropdowns.
function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const update = () => setMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return mobile
}

interface QualityLevel { index: number; height: number; bitrate: number }
interface AudioTrack   { id: number; name: string; lang?: string }
interface SubTrack     { id: number; name: string }
interface SourceItem   { label: string; src: string; lang?: string; quality?: string }

// Map a BCP-47 code or short manifest name ("ko", "KOR (5.1)") to a clean spoken-language
// name, preserving any channel hint like "(5.1)".
const LANG_NAMES: Record<string, string> = {
  ko: 'Korean', kor: 'Korean', en: 'English', eng: 'English', hi: 'Hindi', hin: 'Hindi',
  ta: 'Tamil', te: 'Telugu', vi: 'Vietnamese', vie: 'Vietnamese', es: 'Spanish', spa: 'Spanish',
  fr: 'French', fra: 'French', fre: 'French', de: 'German', ger: 'German', deu: 'German',
  ar: 'Arabic', ara: 'Arabic', pt: 'Portuguese', por: 'Portuguese', ru: 'Russian', rus: 'Russian',
  ja: 'Japanese', jpn: 'Japanese', it: 'Italian', ita: 'Italian', zh: 'Chinese', chi: 'Chinese', zho: 'Chinese',
}
function prettyAudio(t: AudioTrack): string {
  const code = (t.lang || '').toLowerCase().split('-')[0]
  const chan = /\(([^)]*\d[^)]*)\)/.exec(t.name || '')?.[1]     // e.g. "5.1"
  const base = LANG_NAMES[code]
    || LANG_NAMES[(t.name || '').toLowerCase().split(/[\s(]/)[0]]
    || (t.name || 'Audio').replace(/\s*\([^)]*\)\s*/g, '').trim()
    || 'Audio'
  return chan ? `${base} · ${chan}` : base
}

interface ExtSubtitle { label: string; language: string; url: string; default: boolean }
interface ParsedCue  { start: number; end: number; text: string }

interface SubPrefs {
  size: 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'
  color: 'white' | 'yellow' | 'cyan'
  bg: 'glass' | 'dark' | 'none'
  bold: boolean
  shadow: boolean
}
const DEFAULT_SUB_PREFS: SubPrefs = { size: '2xl', color: 'white', bg: 'none', bold: true, shadow: true }   // '2xl' = the "L" size

// Progressive buffering messages (same UX as the Server 1–5 iframe loader).
const BUFFER_MESSAGES = [
  { text: 'Preparing stream…',              sub: null },
  { text: 'Connecting to source…',          sub: null },
  { text: 'Still buffering…',               sub: 'This is taking a while.' },
  { text: 'Taking longer than expected.',   sub: 'Trying another source…' },
] as const
const SUB_PREFS_KEY = 'movora_sub_prefs'

const SUB_PREFS_VERSION = 3   // bumped when default size changed to L ('2xl')
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
  src: string       // .m3u8 or .mp4 direct URL (used when `sources` is not provided)
  sources?: SourceItem[]   // optional multi-source list (quality/language) with internal switching + failover
  activeSourceIdx?: number                       // optional controlled source index (kept in sync with an external picker)
  onSourceChange?: (i: number) => void           // called when the source changes (menu click or auto-failover)
  onSourcesExhausted?: () => void               // every source failed → let the parent fall back (e.g. iframe servers)
  title?: string
  poster?: string
  externalSubtitles?: ExtSubtitle[]
  startAt?: number
  tmdbId?: string
  mediaType?: 'movie' | 'tv'
  season?: number
  episode?: number
  year?: number
  runtime?: number
  rating?: number
  synopsis?: string
  episodeTitle?: string      // TV: current episode name (Netflix-style overlay)
  episodeOverview?: string   // TV: current episode synopsis
  onProgress?: (time: number, duration: number) => void   // real playback position → Continue Watching
  episodes?: EpisodeMeta[]   // TV: current season's episodes (in-player list)
  seasons?: { seasonNumber: number; episodeCount: number }[]   // TV: all seasons (next-episode across seasons)
  onEpisodeChange?: (season: number, episode: number) => void   // TV: user picked / advanced an episode
  titleLogo?: string | null  // TMDB title-treatment logo; falls back to the text title when absent
  busy?: boolean             // parent is swapping the episode/source — show the buffering overlay, stay mounted
}

interface EpisodeMeta { episodeNumber: number; name: string; overview?: string; stillUrl?: string; runtime?: number }

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
  id?: string              // OpenSubtitles file_id — downloaded via /api/subtitles/vtt?id=
  display: string          // e.g. "English"
  language: string         // e.g. "en"
  url?: string             // legacy (unused with the official API)
  flag: string | null
  release?: string         // release/file name so users can match their video's sync
  downloads?: number       // popularity — higher usually means better sync
  hi?: boolean             // hearing-impaired
  origin?: string          // release type: BluRay / WEB / HDRip
}

type Menu = 'settings' | 'ossearch' | 'sub' | 'episodes' | null
type SettingsTab = 'quality' | 'audio' | 'subs' | 'style' | 'speed'

export default function VideoPlayer({ src, sources, activeSourceIdx: controlledSrcIdx, onSourceChange, onSourcesExhausted, title, poster, externalSubtitles, startAt, tmdbId, mediaType = 'movie', season, episode, year, runtime, rating, synopsis, episodeTitle, episodeOverview, onProgress, episodes, seasons, onEpisodeChange, titleLogo, busy }: Props) {
  const [internalSrcIdx, setInternalSrcIdx] = useState(0)
  const activeSourceIdx = controlledSrcIdx ?? internalSrcIdx
  const selectSource = useCallback((i: number) => { if (onSourceChange) onSourceChange(i); else setInternalSrcIdx(i) }, [onSourceChange])
  const effSrc = (sources && sources.length > 0) ? (sources[activeSourceIdx]?.src ?? src) : src
  const failedSrcRef = useRef<Set<number>>(new Set())   // sources that errored out (auto-failover)
  const srcErrCountRef = useRef(0)                        // fatal errors for the current source
  const resumeAtRef = useRef(0)                           // playback position to restore across a source/audio switch
  const wasPlayingRef = useRef(true)                     // resume play state after a source switch
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
  const [settingsTab,  setSettingsTab]  = useState<SettingsTab>('subs')
  const [panelSeason,  setPanelSeason]  = useState<number | undefined>(season)   // season shown in the episodes panel
  const [panelEpisodes, setPanelEpisodes] = useState<EpisodeMeta[]>(episodes ?? [])
  const isMobile = useIsMobile()
  const [loading,      setLoading]      = useState(true)
  const [loadPhase,    setLoadPhase]    = useState(0)   // progressive buffering message index
  const [curExtSub,    setCurExtSub]    = useState<number>(-1)  // always off by default
  const [currentCue,   setCurrentCue]   = useState<string>('')
  const [subOffset,    setSubOffset]    = useState(0)          // subtitle sync offset in seconds (+ = later)
  const subOffsetRef   = useRef(0)
  useEffect(() => { subOffsetRef.current = subOffset }, [subOffset])
  const onProgressRef  = useRef(onProgress)
  useEffect(() => { onProgressRef.current = onProgress }, [onProgress])
  const lastProgressRef = useRef(0)   // throttle progress reports to ~every 5s
  const parsedCuesRef      = useRef<ParsedCue[]>([])
  const hlsSubVidTrackRef  = useRef<number>(-1)
  const subTrackRef        = useRef<HTMLTrackElement>(null)  // native <track> for iOS fullscreen subtitles
  const [localSubs,        setLocalSubs]    = useState<ExtSubtitle[]>([])
  const fileInputRef       = useRef<HTMLInputElement>(null)
  const blobUrlsRef        = useRef<string[]>([])  // track blob URLs for cleanup

  // Combine API subs + locally uploaded subs
  const allExtSubs = [...(externalSubtitles ?? []), ...localSubs]
  const activeSub = curExtSub >= 0 ? allExtSubs[curExtSub] : null   // for the native iOS-fullscreen track

  // OpenSubtitles search state
  const [osResults,   setOsResults]   = useState<OSResult[]>([])
  const [osLoading,   setOsLoading]   = useState(false)
  const [osError,     setOsError]     = useState<string | null>(null)
  const [osSearched,  setOsSearched]  = useState(false)

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

  // Auto-show the best English subtitle when a fresh list arrives (new title/episode). The backend
  // returns English first, ranked by WEB-DL match, so index-of-first-English is the best pick. Fires
  // once per list; the user stays free to switch variants or turn subs off afterwards.
  const autoSubListRef = useRef<ExtSubtitle[] | null>(null)
  useEffect(() => {
    const subs = externalSubtitles ?? []
    if (!subs.length || autoSubListRef.current === subs) return
    autoSubListRef.current = subs
    const enIdx = subs.findIndex(s => s.language === 'en' || /english/i.test(s.label))
    if (enIdx >= 0) setCurExtSub(enIdx)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSubtitles])

  // The native <track> should only render inside iOS's native fullscreen (where our custom HTML
  // cue overlay isn't visible). Keep it 'hidden' everywhere else so we don't get double captions.
  useEffect(() => {
    const t = subTrackRef.current?.track
    if (!t) return
    const v = videoRef.current as (HTMLVideoElement & { webkitDisplayingFullscreen?: boolean }) | null
    // Show the native track whenever our HTML cue overlay can't be seen — i.e. any *native* video
    // fullscreen: iOS webkit, or a TV/Android browser that fullscreens the <video> itself instead
    // of our wrapper div. In wrapper (Fullscreen API) mode the styled HTML overlay handles it.
    const nativeFs = !!v?.webkitDisplayingFullscreen || (!!document.fullscreenElement && document.fullscreenElement === v)
    t.mode = nativeFs ? 'showing' : 'hidden'
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curExtSub, fs, activeSub?.url])


  // Reset failover state when the title/episode changes (first source url is the signal).
  useEffect(() => {
    failedSrcRef.current = new Set()
    resumeAtRef.current = 0        // fresh episode → start from startAt (0), not a stale resume position
    selectSource(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources?.[0]?.src])

  // Parent is swapping episode/source — pause the outgoing stream (its audio stops under the overlay)
  // and mark it as "was playing" so the incoming episode auto-plays, Netflix-style.
  useEffect(() => { if (busy) { wasPlayingRef.current = true; videoRef.current?.pause() } }, [busy])

  // Episodes panel: default to the playing season; refetch that season's list when the user
  // browses a different one (so they can pick from any season without leaving the player).
  useEffect(() => { setPanelSeason(season) }, [season])
  useEffect(() => {
    if (panelSeason === season) { setPanelEpisodes(episodes ?? []); return }
    if (!tmdbId || panelSeason == null) return
    let cancelled = false
    fetch(`/api/episodes?tmdbId=${encodeURIComponent(tmdbId)}&season=${panelSeason}`)
      .then(r => r.ok ? r.json() : [])
      .then((eps: EpisodeMeta[]) => { if (!cancelled) setPanelEpisodes(Array.isArray(eps) ? eps : []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [panelSeason, season, episodes, tmdbId])

  // Latest-value refs so failToNext can stay referentially stable (sources/onSourcesExhausted
  // get a new identity every render, which would otherwise reset the stall-watchdog interval).
  const sourcesRef = useRef(sources); useEffect(() => { sourcesRef.current = sources }, [sources])
  const activeSourceIdxRef = useRef(activeSourceIdx); useEffect(() => { activeSourceIdxRef.current = activeSourceIdx }, [activeSourceIdx])
  const onSourceChangeRef = useRef(onSourceChange); useEffect(() => { onSourceChangeRef.current = onSourceChange }, [onSourceChange])
  const onSourcesExhaustedRef = useRef(onSourcesExhausted); useEffect(() => { onSourcesExhaustedRef.current = onSourcesExhausted }, [onSourcesExhausted])

  // Mark the current source failed and move on. Used by both the HLS error handler and the
  // stall watchdog. Returns true if it switched, false if every source is exhausted.
  const failToNext = useCallback((): boolean => {
    const srcs = sourcesRef.current
    const cur = activeSourceIdxRef.current
    if (srcs && srcs.length > 0) {
      failedSrcRef.current.add(cur)
      const next = srcs.findIndex((_, i) => !failedSrcRef.current.has(i))
      if (next !== -1 && next !== cur) {
        const v = videoRef.current
        if (v && v.currentTime > 0) { resumeAtRef.current = v.currentTime; wasPlayingRef.current = !v.paused }
        if (onSourceChangeRef.current) onSourceChangeRef.current(next); else setInternalSrcIdx(next)
        return true
      }
    }
    onSourcesExhaustedRef.current?.()
    return false
  }, [])

  // Advance the buffering message the longer we wait (Preparing → Connecting → Still → Longer).
  useEffect(() => {
    if (!loading) { setLoadPhase(0); return }
    const timers = [
      setTimeout(() => setLoadPhase(1), 1500),
      setTimeout(() => setLoadPhase(2), 4000),
      setTimeout(() => setLoadPhase(3), 8000),
    ]
    return () => timers.forEach(clearTimeout)
  }, [loading, effSrc])

  // Stall watchdog — some dead streams return a valid manifest but never deliver segments, so
  // HLS.js buffers forever without a *fatal* error and our error-based failover never fires.
  // If the player is still buffering with no playback progress after ~14s, treat the source as
  // dead and move to the next one (or fall back to the iframe servers when exhausted).
  useEffect(() => {
    if (!loading) return
    let lastTime = videoRef.current?.currentTime ?? 0
    let stalledMs = 0
    const STEP = 2500, LIMIT = 14000
    const id = setInterval(() => {
      const v = videoRef.current
      if (!v) return
      if (v.currentTime > lastTime + 0.25) { lastTime = v.currentTime; stalledMs = 0; return }
      stalledMs += STEP
      // Only bail while still trying to START playback — mid-playback stalls are handled by
      // HLS fragment-timeout errors and shouldn't yank a source over a brief network hiccup.
      if (v.currentTime < 1 && stalledMs >= LIMIT) { stalledMs = 0; failToNext() }
    }, STEP)
    return () => clearInterval(id)
  }, [loading, effSrc, failToNext])

  // ── HLS init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video || !effSrc) return

    async function init() {
      setLoading(true)
      srcErrCountRef.current = 0
      // Our sealed proxy urls (/api/stream/hls?d=…) and the sports proxy serve HLS — treat them
      // as HLS even though the token url has no .m3u8 in it.
      const isHls = effSrc.includes('.m3u8') || effSrc.includes('/hls') || effSrc.includes('/api/stream/hls') || effSrc.includes('/api/sports/proxy') || effSrc.includes('master')

      if (isHls) {
        const Hls = (await import('hls.js')).default
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            startLevel: -1,
            startFragPrefetch: true,      // fetch the first fragment ASAP for a faster first frame
            abrEwmaDefaultEstimate: 3000000,
            maxBufferLength: 30,
            maxBufferSize: 30 * 1000 * 1000,
            lowLatencyMode: false,
            // Fail fast so a dead source auto-switches within ~8s instead of hanging.
            manifestLoadingTimeOut: 8000,
            manifestLoadingMaxRetry: 1,
            levelLoadingTimeOut: 8000,
            fragLoadingTimeOut: 12000,
            ...({ enableFetchForXhr: true } as any),
            fetchSetup: (context: any, initParams: any) => {
              initParams.referrerPolicy = 'no-referrer'
              return new Request(context.url, initParams)
            },
          })
          hlsRef.current = hls
          hls.loadSource(effSrc)
          hls.attachMedia(video!)

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            const lvls = hls.levels.map((l: any, i: number) => ({
              index: i, height: l.height || 0, bitrate: l.bitrate || 0,
            }))
            setQualities(lvls)
            // Restore position after an internal source/audio switch, else honour startAt.
            const seekTo = resumeAtRef.current > 0 ? resumeAtRef.current : (startAt && startAt > 0 ? startAt : 0)
            if (seekTo > 0) video!.currentTime = seekTo
            resumeAtRef.current = 0
            hls.subtitleTrack = -1  // disable any DEFAULT HLS subtitle track
            if (wasPlayingRef.current) {
              const p = video!.play()
              if (p && typeof p.catch === 'function') p.catch(() => {}) // autoplay may be blocked — that's fine
            }
          })

          hls.on(Hls.Events.ERROR, (_: any, data: any) => {
            if (!data.fatal) return
            srcErrCountRef.current++
            // One recovery attempt for the current source…
            if (srcErrCountRef.current <= 1) {
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) { try { hls.startLoad(); return } catch { /* */ } }
              if (data.type === Hls.ErrorTypes.MEDIA_ERROR) { try { hls.recoverMediaError(); return } catch { /* */ } }
            }
            // …otherwise auto-switch to the next untried source (no manual action needed).
            if (failToNext()) return
            console.error('[HLS] all sources failed', data.type, data.details)
            setLoading(false)
          })

          hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_: any, d: any) => {
            setAudioTracks(d.audioTracks.map((t: any) => ({ id: t.id, name: t.name, lang: t.lang || t.language })))
            setCurAudio(hls.audioTrack)
          })

          hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_: any, d: any) => {
            setSubTracks(d.subtitleTracks.map((t: any) => ({ id: t.id, name: t.name })))
            hls.subtitleTrack = -1  // ensure off by default
          })
        } else if (video!.canPlayType('application/vnd.apple.mpegurl')) {
          startNative()
        }
      } else {
        startNative()
      }

      function startNative() {
        video!.src = effSrc
        video!.onloadedmetadata = () => {
          const seekTo = resumeAtRef.current > 0 ? resumeAtRef.current : (startAt && startAt > 0 ? startAt : 0)
          if (seekTo > 0) video!.currentTime = seekTo
          resumeAtRef.current = 0
          if (wasPlayingRef.current) safePlay()
        }
      }
    }

    init()
    return () => { hlsRef.current?.destroy(); hlsRef.current = null }
  }, [effSrc])

  // ── Video events ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const reportProgress = () => {
      const vv = videoRef.current
      if (vv && onProgressRef.current && vv.duration > 0 && vv.currentTime > 0) onProgressRef.current(vv.currentTime, vv.duration)
    }
    const onPlay       = () => setPlaying(true)
    const onPause      = () => { setPlaying(false); reportProgress() }   // capture position on pause
    const onWaiting    = () => setLoading(true)
    const onCanPlay    = () => setLoading(false)
    const onTimeUpdate = () => {
      if (!v) return
      setCurrent(v.currentTime)
      if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1))
      // Report real playback position to Continue Watching, throttled to ~5s.
      if (onProgressRef.current && v.duration > 0) {
        const now = Date.now()
        if (now - lastProgressRef.current > 5000) { lastProgressRef.current = now; onProgressRef.current(v.currentTime, v.duration) }
      }
      const t = v.currentTime - subOffsetRef.current   // apply subtitle sync offset
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

    window.addEventListener('pagehide', reportProgress)

    return () => {
      reportProgress()   // persist position when leaving the page
      window.removeEventListener('pagehide', reportProgress)
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
      const isFull = !!(document.fullscreenElement || v?.webkitDisplayingFullscreen)
      setFs(isFull)
      if (!isFull) { try { (screen.orientation as any)?.unlock?.() } catch {} }   // release landscape lock on exit
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
        case ' ': case 'k': e.preventDefault(); if (v.paused) safePlay(); else v.pause(); break
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
  const openMenuRef = useRef(openMenu)
  useEffect(() => { openMenuRef.current = openMenu }, [openMenu])
  const resetHide = useCallback(() => {
    setShowCtrl(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      const v = videoRef.current
      // Don't auto-hide (or close) while a menu/panel is open — it was closing the
      // OpenSubtitles search and other menus mid-use.
      if (v && !v.paused && !openMenuRef.current) { setShowCtrl(false); setOpenMenu(null) }
    }, 3500)
  }, [])

  // ── Actions ───────────────────────────────────────────────────────────────────
  // play() returns a promise that rejects with AbortError if pause()/load() interrupts it
  // (e.g. during an internal source switch). Always swallow it so it never surfaces as an
  // unhandled runtime error.
  function safePlay() {
    const v = videoRef.current
    if (!v) return
    const p = v.play()
    if (p && typeof p.catch === 'function') p.catch(() => {})
  }

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) safePlay(); else v.pause()
  }

  function toggleFs() {
    const wrap = wrapRef.current
    const v = videoRef.current as HTMLVideoElement & { webkitEnterFullscreen?: () => void; webkitExitFullscreen?: () => void; webkitDisplayingFullscreen?: boolean }
    // Exit
    if (document.fullscreenElement) { try { (screen.orientation as any)?.unlock?.() } catch {}; document.exitFullscreen(); return }
    if (v?.webkitDisplayingFullscreen) { v.webkitExitFullscreen?.(); return }
    // Enter — iOS (PWA + Safari) doesn't support requestFullscreen on divs
    if (document.fullscreenEnabled && wrap?.requestFullscreen) {
      wrap.requestFullscreen()
        .then(() => {
          // Rotate to landscape on mobile (Netflix/YouTube-style). Desktop rejects this with
          // NotSupportedError — lock() returns a promise, so swallow the rejection, not a throw.
          try { const p = (screen.orientation as any)?.lock?.('landscape'); if (p && typeof p.catch === 'function') p.catch(() => {}) } catch {}
        })
        .catch(() => {})
    } else if (v?.webkitEnterFullscreen) {
      v.webkitEnterFullscreen()  // iOS native fullscreen handles its own rotation
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

  // Switch to a different source (e.g. a separate-language dub) while keeping the current
  // position + play state. Used by the Audio menu's alternate-language entries.
  function switchToSource(i: number) {
    if (i === activeSourceIdx) { setOpenMenu(null); return }
    const v = videoRef.current
    if (v) { resumeAtRef.current = v.currentTime; wasPlayingRef.current = !v.paused }
    failedSrcRef.current = new Set()   // manual choice — clear the failover blacklist
    selectSource(i)
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

  // Load every available online subtitle at once, one per language, sorted A→Z — shown as a
  // compact list (no language dropdown / Search button needed).
  async function searchAllSubtitles() {
    if (!tmdbId) return
    setOsLoading(true); setOsError(null); setOsSearched(false); setOsResults([])
    try {
      const params = new URLSearchParams({ tmdb: tmdbId, type: mediaType, all: '1' })
      if (season)  params.set('season',  String(season))
      if (episode) params.set('episode', String(episode))
      const res = await fetch(`/api/subtitles/search?${params}`)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      // Keep every variant (multiple per language) so users can pick the one that matches their
      // release — grouped by language A→Z, most-downloaded first within each language.
      const subs = ((data.subtitles || []) as OSResult[])
        .sort((a, b) => (a.display || '').localeCompare(b.display || '') || (b.downloads || 0) - (a.downloads || 0))
      setOsResults(subs)
      setOsSearched(true)
    } catch {
      setOsError('Couldn’t load subtitles. Check your connection.')
    } finally {
      setOsLoading(false)
    }
  }

  async function pickOsSubtitle(result: OSResult) {
    const vtt = `/api/subtitles/vtt?id=${encodeURIComponent(result.id || '')}`
    // Tag with a short release token (BluRay/WEB/RARBG…) so multiple picks of one language stay distinguishable.
    const relTag = (result.release || '').match(/\b(blu-?ray|web-?dl|webrip|hdrip|brrip|bdrip|dvdrip|hdtv|rarbg|yify|yts|amzn|nf)\b/i)?.[0]
    const label = `🌐 ${result.display}${result.hi ? ' (HI)' : ''}${relTag ? ` · ${relTag}` : ''}`
    const newSub: ExtSubtitle = { label, language: result.language, url: vtt, default: false }
    setLocalSubs(prev => {
      const next = [...prev, newSub]
      setCurExtSub((externalSubtitles?.length ?? 0) + next.length - 1)
      return next
    })
    setOpenMenu(null)
  }

  // ── Netflix-style unified Audio menu ─────────────────────────────────────────
  // Present spoken languages (never "servers") and always highlight the one playing. Combine
  // (a) the current stream's embedded audio tracks with a *known* language, (b) an "Original"
  // entry for the multi-audio stream's default track (ShowBox often tags it LANGUAGE="un"),
  // and (c) alternate-language dub streams (separate Hindi/Vietnamese/… sources).
  const activeSource = sources?.[activeSourceIdx]
  const trackKnown = (t: AudioTrack) => {
    const code = (t.lang || '').toLowerCase()
    return !!code && code !== 'un' && code !== 'und' && !/unknown/i.test(t.name || '')
  }
  const knownEmbedded = audioTracks.filter(trackKnown)
  const embLangs = new Set(knownEmbedded.map(t => prettyAudio(t).split(' · ')[0]))
  const multiIdx = (sources ?? []).findIndex(s => !s.lang)   // the original multi-audio stream
  const onMulti = !activeSource?.lang
  const dubs = (sources ?? [])
    .map((s, i) => ({ lang: s.lang || '', i }))
    .filter(x => x.lang && !embLangs.has(x.lang))
    .filter((x, idx, arr) => arr.findIndex(y => y.lang === x.lang) === idx)   // one per language

  interface AudioItem { key: string; label: string; active: boolean; onClick: () => void; dub: boolean }
  const audioItems: AudioItem[] = []
  if (onMulti) {
    if (knownEmbedded.length) {
      for (const t of knownEmbedded) audioItems.push({ key: `e${t.id}`, label: prettyAudio(t), active: curAudio === t.id, onClick: () => setAudio(t.id), dub: false })
    } else {
      audioItems.push({ key: 'orig', label: 'Original', active: true, onClick: () => setOpenMenu(null), dub: false })
    }
  } else if (multiIdx >= 0) {
    audioItems.push({ key: 'orig', label: 'Original', active: false, onClick: () => switchToSource(multiIdx), dub: false })
  }
  for (const d of dubs) audioItems.push({ key: `s${d.i}`, label: d.lang, active: activeSource?.lang === d.lang, onClick: () => switchToSource(d.i), dub: true })
  const dubStart = audioItems.findIndex(it => it.dub)
  const hasAudioMenu = audioItems.length > 1

  // ── Quality menu ──────────────────────────────────────────────────────────────
  // ShowBox exposes each resolution as its own stream, so quality = pick a source (not an
  // HLS ABR level). Order high→low; "Original" last (raw file, least reliable to decode).
  const QUAL_RANK: Record<string, number> = { '4K': 6, '1440p': 5, '1080p': 4, '720p': 3, '480p': 2, '360p': 1, 'Original': 0 }
  const qualitySources = (sources ?? [])
    .map((s, i) => ({ ...s, i }))
    .filter(s => s.quality)
    .filter((s, idx, arr) => arr.findIndex(x => x.quality === s.quality) === idx)   // dedupe by resolution
    .sort((a, b) => (QUAL_RANK[b.quality!] ?? -1) - (QUAL_RANK[a.quality!] ?? -1))
  const hasQualitySources = qualitySources.length > 1

  const progress    = duration > 0 ? (current / duration) * 100 : 0
  const bufPct      = duration > 0 ? (buffered / duration) * 100 : 0
  const qualLabel   = curQuality === -1 ? 'Auto' : (qualities[curQuality]?.height > 0 ? `${qualities[curQuality].height}p` : 'Auto')
  const qualBtnLabel = hasQualitySources ? (activeSource?.quality || 'HD') : qualLabel
  const ctrlVisible = showCtrl || !playing

  const hasCC = allExtSubs.length > 0 || subTracks.length > 0 || !!tmdbId

  // ── TV: in-player episode list + Next Episode navigation ──
  const isTV = mediaType === 'tv' && !!onEpisodeChange && season != null && episode != null
  const seasonEpCount = seasons?.find(s => s.seasonNumber === season)?.episodeCount ?? episodes?.length ?? 0
  const hasNextEpisode = !!isTV && (
    episode! < seasonEpCount ||
    !!seasons?.some(s => s.seasonNumber === season! + 1 && s.episodeCount > 0)
  )
  const hasEpisodeList = !!isTV && (episodes?.length ?? 0) > 0
  const goNextEpisode = () => {
    if (!onEpisodeChange || season == null || episode == null) return
    if (episode < seasonEpCount) onEpisodeChange(season, episode + 1)
    else if (seasons?.some(s => s.seasonNumber === season + 1 && s.episodeCount > 0)) onEpisodeChange(season + 1, 1)
  }

  // Tabs for the consolidated Settings modal (only show what's available).
  const settingsTabs: { id: SettingsTab; label: string }[] = [
    ...((hasQualitySources || qualities.length > 1) ? [{ id: 'quality' as SettingsTab, label: 'Quality' }] : []),
    ...(hasAudioMenu ? [{ id: 'audio' as SettingsTab, label: 'Audio' }] : []),
    ...(hasCC ? [{ id: 'subs' as SettingsTab, label: 'Subtitles' }, { id: 'style' as SettingsTab, label: 'Aa' }] : []),
    { id: 'speed' as SettingsTab, label: 'Speed' },
  ]
  const activeTab: SettingsTab = settingsTabs.some(t => t.id === settingsTab) ? settingsTab : settingsTabs[0].id

  const subBgClass = subPrefs.bg === 'glass'
    ? 'bg-white/10 backdrop-blur-xl backdrop-saturate-150 border border-white/20 shadow-[0_4px_24px_rgba(0,0,0,0.4)]'
    : subPrefs.bg === 'dark'
    ? 'bg-black/60 backdrop-blur-sm border border-white/10'
    : 'bg-transparent border-transparent'
  const subTextClass = [
    subPrefs.size === 'sm'  ? 'text-[10px] sm:text-sm'      :
    subPrefs.size === 'base'? 'text-xs sm:text-base'         :
    subPrefs.size === 'lg'  ? 'text-sm sm:text-lg'           :
    subPrefs.size === 'xl'  ? 'text-sm sm:text-xl'           :
    subPrefs.size === '2xl' ? 'text-base sm:text-2xl'        :
    subPrefs.size === '3xl' ? 'text-lg sm:text-3xl'          : 'text-xl sm:text-4xl',
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
      onMouseLeave={() => { if (playing && !openMenu) setShowCtrl(false) }}
    >
      {/* Video */}
      <video ref={videoRef} className="w-full h-full object-contain" poster={poster} playsInline onClick={togglePlay}>
        {/* Native track — only rendered so iOS's native fullscreen player can show subtitles
            (our custom HTML cue overlay isn't visible there). Kept 'hidden' otherwise. */}
        {activeSub && (
          <track ref={subTrackRef} key={activeSub.url} kind="subtitles" src={activeSub.url} label={activeSub.label} srcLang={activeSub.language || 'en'} />
        )}
      </video>

      {/* Netflix-style info overlay while paused — bottom-left, video stays visible */}
      {!playing && !loading && !busy && (title || year || runtime || rating) && (
        <div className="absolute inset-0 pointer-events-none z-[15]">
          {/* Soft left + bottom gradient for legibility (no heavy full-screen dim) */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 to-transparent" />

          <div className="absolute left-0 bottom-0 px-5 sm:px-10 pb-20 sm:pb-32 max-w-[88%] sm:max-w-xl">
            <p className="text-white/55 text-[10px] sm:text-sm font-medium mb-1 sm:mb-2 tracking-wide">You're watching</p>
            {/* Title-treatment logo (like Server 1) when available; else the plain text title. */}
            {titleLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={titleLogo} alt={title || ''}
                className="w-auto max-w-[70%] sm:max-w-sm max-h-16 sm:max-h-28 object-contain object-left drop-shadow-2xl mb-1.5 sm:mb-3" />
            ) : title ? (
              <h3 className="text-white font-black drop-shadow-2xl mb-1.5 sm:mb-3 leading-[1.05]"
                style={{ fontSize: 'clamp(1.4rem, 5vw, 3rem)' }}>
                {title}
              </h3>
            ) : null}
            {(year || runtime || rating) && (
              <div className="flex items-center gap-2 mb-1.5 sm:mb-3 flex-wrap">
                {year && <span className="text-white/75 text-[11px] sm:text-sm font-medium">{year}</span>}
                {runtime && runtime > 0 && (
                  <><span className="text-white/30">·</span>
                  <span className="text-white/75 text-[11px] sm:text-sm font-medium">{Math.floor(runtime/60) > 0 ? `${Math.floor(runtime/60)}h ${runtime%60 > 0 ? `${runtime%60}m` : ''}`.trim() : `${runtime}m`}</span></>
                )}
                {rating && rating > 0 && (
                  <><span className="text-white/30">·</span>
                  <span className="flex items-center gap-1 text-[11px] sm:text-sm font-semibold text-amber-400">
                    <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    {rating.toFixed(1)}
                  </span></>
                )}
              </div>
            )}
            {/* TV: bold episode line — "Episode Title: Ep. N" (Netflix-style) */}
            {episodeTitle && episode ? (
              <p className="text-white font-bold text-sm sm:text-lg mt-2 sm:mt-4 mb-1 sm:mb-2 leading-snug drop-shadow">
                {episodeTitle}: Ep. {episode}
              </p>
            ) : null}
            {(episodeOverview || synopsis) && (
              <p className="text-white/65 text-[11px] sm:text-sm leading-relaxed line-clamp-2 sm:line-clamp-3 drop-shadow">{episodeOverview || synopsis}</p>
            )}
          </div>

          {/* Paused indicator, bottom-right */}
          <div className="absolute right-5 sm:right-8 bottom-20 sm:bottom-32 flex items-center gap-1.5 text-white/50 text-[11px] sm:text-sm font-medium">
            <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            Paused
          </div>
        </div>
      )}

      {/* Buffering overlay — premium loader like the Server 1–5 iframes.
          Initial buffer (no frame yet): blurred backdrop + title + "Buffering…".
          Mid-playback stall: spinner over a light scrim so the frame stays visible. */}
      {(loading || busy) && (
        <div className="absolute inset-0 z-[16] pointer-events-none overflow-hidden">
          {(current < 1 || busy) && poster ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50 scale-105" style={{ filter: 'blur(2px)' }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0 bg-black/25" />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-[3px] border-white/10 border-t-[#06D6E0] animate-spin" />
          </div>
          {current < 1 && title && (
            <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 sm:px-7 sm:pb-7">
              <p className="text-white font-semibold text-base sm:text-lg leading-tight mb-1 drop-shadow-lg">{title}</p>
              <p className={`text-sm font-medium drop-shadow transition-opacity duration-300 ${loadPhase >= 3 ? 'text-amber-400' : 'text-[#06D6E0]'}`}>
                {BUFFER_MESSAGES[loadPhase].text}
              </p>
              {BUFFER_MESSAGES[loadPhase].sub && (
                <p className="text-xs text-white/50 mt-1 drop-shadow">{BUFFER_MESSAGES[loadPhase].sub}</p>
              )}
            </div>
          )}
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
            <button onClick={() => { if (videoRef.current) videoRef.current.currentTime -= 10 }} className="p-2 opacity-70 hover:opacity-100 transition-opacity" aria-label="Rewind 10 seconds">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/platforms/icons8-replay-10-50.png" alt="" className="w-5 h-5" style={{ filter: 'brightness(0) invert(1)' }} />
            </button>

            {/* Skip +10 */}
            <button onClick={() => { if (videoRef.current) videoRef.current.currentTime += 10 }} className="p-2 opacity-70 hover:opacity-100 transition-opacity" aria-label="Forward 10 seconds">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/platforms/icons8-forward-10-50.png" alt="" className="w-5 h-5" style={{ filter: 'brightness(0) invert(1)' }} />
            </button>

            {/* Next Episode (TV) */}
            {hasNextEpisode && (
              <button onClick={goNextEpisode} className="p-2 text-white/70 hover:text-white transition-colors" title="Next episode" aria-label="Next episode">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" stroke="none"/><line x1="19" y1="5" x2="19" y2="19"/>
                </svg>
              </button>
            )}

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

            {/* Episodes (TV) — in-player season/episode list */}
            {hasEpisodeList && (
              <button onClick={() => setOpenMenu(openMenu === 'episodes' ? null : 'episodes')}
                className={`p-2 transition-colors ${openMenu === 'episodes' ? 'text-[#06D6E0]' : 'text-white/60 hover:text-white'}`} title="Episodes" aria-label="Episodes">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="14" height="10" rx="1.5"/><line x1="21" y1="8" x2="21" y2="16"/><line x1="7" y1="19" x2="17" y2="19"/>
                </svg>
              </button>
            )}

            {/* Quality badge — shows what's playing; taps into the Quality tab */}
            {(hasQualitySources || qualities.length > 1) && (
              <button onClick={() => { setSettingsTab('quality'); setOpenMenu('settings') }}
                className="p-2 text-sm font-semibold text-white/70 hover:text-white transition-colors" title="Quality">
                {qualBtnLabel}
              </button>
            )}

            {/* Settings — consolidated Quality / Audio / Subtitles / Style / Speed */}
            <button onClick={() => setOpenMenu(openMenu === 'settings' ? null : 'settings')}
              className={`p-2 transition-colors ${openMenu === 'settings' ? 'text-[#06D6E0]' : 'text-white/60 hover:text-white'}`} title="Settings">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>

            {/* PiP — hidden on mobile to avoid crowding the control bar */}
            <button onClick={async () => { const v = videoRef.current; if (!v) return; try { document.pictureInPictureElement ? await document.exitPictureInPicture() : await v.requestPictureInPicture() } catch {} }}
              className="hidden sm:block p-2 text-white/60 hover:text-white transition-colors">
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
      {/* Settings modal — Quality / Audio / Subtitles / Aa / Speed, all in one place.
          On mobile it's portaled to <body> so the player's overflow/stacking can't hide it. */}
      {openMenu === 'settings' && ((m: React.ReactNode) => (isMobile && typeof document !== 'undefined' ? createPortal(m, document.body) : m))(
        <>
          <div className={`fixed inset-0 ${isMobile ? 'z-[998] bg-black/80' : 'z-40'}`} onPointerDown={e => { e.stopPropagation(); setOpenMenu(null) }} />
          <div style={{ backgroundColor: isMobile ? 'rgba(14,14,17,0.92)' : 'rgba(17,17,23,0.55)' }} className={`${isMobile ? 'fixed inset-x-0 bottom-0 z-[999] max-h-[82vh] rounded-t-2xl border-t' : 'absolute bottom-10 right-3 sm:right-5 z-50 w-[19rem] max-h-[76%] rounded-xl border'} border-white/10 shadow-2xl flex flex-col overflow-hidden backdrop-blur-2xl backdrop-saturate-150`}>
            {isMobile && <div className="mx-auto mt-2.5 mb-1 h-1 w-10 rounded-full bg-white/20 flex-shrink-0" />}

            {/* Tab bar */}
            <div className="flex gap-1 px-3 pt-2 pb-2 border-b border-white/10 flex-shrink-0 overflow-x-auto [&::-webkit-scrollbar]:hidden">
              {settingsTabs.map(t => (
                <button key={t.id} onClick={() => setSettingsTab(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${activeTab === t.id ? 'bg-[#06D6E0] text-black' : 'text-white/55 hover:text-white hover:bg-white/10'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="overflow-y-auto py-1.5 min-h-0 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
              {activeTab === 'quality' && (hasQualitySources
                ? qualitySources.map(s => (
                    <MenuItem key={`q${s.i}`} active={activeSourceIdx === s.i} onClick={() => switchToSource(s.i)}>{s.quality}{s.quality === '4K' ? ' · HDR' : ''}</MenuItem>
                  ))
                : <>
                    <MenuItem active={curQuality === -1} onClick={() => setQuality(-1)}>Auto</MenuItem>
                    {[...qualities].reverse().map(q => (
                      <MenuItem key={q.index} active={curQuality === q.index} onClick={() => setQuality(q.index)}>{q.height > 0 ? `${q.height}p` : `Level ${q.index}`}</MenuItem>
                    ))}
                  </>
              )}

              {activeTab === 'audio' && audioItems.map((it, idx) => (
                <div key={it.key}>
                  {idx === dubStart && dubStart > 0 && <div className="mx-4 my-1.5 border-t border-white/10" />}
                  <MenuItem active={it.active} onClick={it.onClick}>{it.label}</MenuItem>
                </div>
              ))}

              {activeTab === 'subs' && (
                <>
                  {allExtSubs.length > 0 ? (
                    <>
                      <MenuItem active={curExtSub === -1} onClick={() => setExtSub(-1)}>Off</MenuItem>
                      {allExtSubs.map((s, i) => (<MenuItem key={i} active={curExtSub === i} onClick={() => setExtSub(i)}>{s.label}</MenuItem>))}
                    </>
                  ) : (
                    <>
                      <MenuItem active={curSub === -1} onClick={() => setSub(-1)}>Off</MenuItem>
                      {subTracks.map(t => (<MenuItem key={t.id} active={curSub === t.id} onClick={() => setSub(t.id)}>{t.name}</MenuItem>))}
                    </>
                  )}
                  <div className="mx-4 my-1.5 border-t border-white/10" />
                  <button onClick={() => fileInputRef.current?.click()} className="w-full text-left px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"><span>📁</span> Upload (.srt / .vtt)</button>
                  {tmdbId && (
                    <button onClick={() => { setOpenMenu('ossearch'); searchAllSubtitles() }} className="w-full text-left px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"><span>🔍</span> Search more subtitles</button>
                  )}
                  {(curExtSub >= 0 || curSub >= 0) && (
                    <>
                      <div className="mx-4 my-1.5 border-t border-white/10" />
                      <div className="px-4 py-2 flex items-center justify-between gap-2">
                        <span className="text-xs text-white/50">Sync</span>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setSubOffset(o => Math.round((o - 0.5) * 10) / 10)} className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 text-white text-base font-bold flex items-center justify-center">−</button>
                          <button onClick={() => setSubOffset(0)} className="min-w-[52px] text-center text-xs font-mono text-white/70 hover:text-white tabular-nums" title="Reset sync">{subOffset > 0 ? '+' : ''}{subOffset.toFixed(1)}s</button>
                          <button onClick={() => setSubOffset(o => Math.round((o + 0.5) * 10) / 10)} className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 text-white text-base font-bold flex items-center justify-center">+</button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {activeTab === 'style' && (
                <div className="p-3 space-y-4">
                  <div>
                    <p className="text-xs text-white/50 mb-1.5">Size</p>
                    <div className="flex gap-1.5">
                      {([['base','XS'],['lg','S'],['xl','M'],['2xl','L'],['3xl','XL']] as const).map(([s, label]) => (
                        <button key={s} onClick={() => setSubPrefs(p => ({...p, size: s}))} className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${subPrefs.size === s ? 'bg-[#06D6E0] text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-white/50 mb-1.5">Color</p>
                    <div className="flex gap-2">
                      {([['white','#FFFFFF'],['yellow','#FDE047'],['cyan','#06D6E0']] as const).map(([c, hex]) => (
                        <button key={c} onClick={() => setSubPrefs(p => ({...p, color: c}))} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${subPrefs.color === c ? 'bg-white/20 ring-1 ring-white/40' : 'bg-white/5 hover:bg-white/15'}`}><span className="w-3 h-3 rounded-full border border-white/20 flex-shrink-0" style={{background: hex}} /><span className="text-white/70 capitalize">{c}</span></button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-white/50 mb-1.5">Background</p>
                    <div className="flex gap-1.5">
                      {([['glass','Glass'],['dark','Dark'],['none','None']] as const).map(([b, label]) => (
                        <button key={b} onClick={() => setSubPrefs(p => ({...p, bg: b}))} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${subPrefs.bg === b ? 'bg-[#06D6E0] text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setSubPrefs(p => ({...p, bold: !p.bold}))} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${subPrefs.bold ? 'bg-[#06D6E0] text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>Bold</button>
                    <button onClick={() => setSubPrefs(p => ({...p, shadow: !p.shadow}))} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${subPrefs.shadow ? 'bg-[#06D6E0] text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>Shadow</button>
                    <button onClick={() => setSubPrefs(DEFAULT_SUB_PREFS)} className="flex-1 py-1.5 rounded-lg text-xs text-white/40 bg-white/5 hover:bg-white/10 transition-colors">Reset</button>
                  </div>
                </div>
              )}

              {activeTab === 'speed' && [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(s => (
                <MenuItem key={s} active={speed === s} onClick={() => setPlaySpeed(s)}>{s === 1 ? 'Normal' : `${s}×`}</MenuItem>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Episodes panel (TV) — current season's episodes. Portaled to <body> on mobile like Settings. */}
      {openMenu === 'episodes' && hasEpisodeList && ((m: React.ReactNode) => (isMobile && typeof document !== 'undefined' ? createPortal(m, document.body) : m))(
        <>
          <div className={`fixed inset-0 ${isMobile ? 'z-[998] bg-black/80' : 'z-40'}`} onPointerDown={e => { e.stopPropagation(); setOpenMenu(null) }} />
          <div style={{ backgroundColor: isMobile ? 'rgba(14,14,17,0.92)' : 'rgba(17,17,23,0.6)' }} className={`${isMobile ? 'fixed inset-x-0 bottom-0 z-[999] max-h-[82vh] rounded-t-2xl border-t' : 'absolute bottom-10 right-3 sm:right-5 z-50 w-[24rem] max-h-[78%] rounded-xl border'} border-white/10 shadow-2xl flex flex-col overflow-hidden backdrop-blur-2xl backdrop-saturate-150`}>
            {isMobile && <div className="mx-auto mt-2.5 mb-1 h-1 w-10 rounded-full bg-white/20 flex-shrink-0" />}

            <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
              <p className="text-sm font-semibold text-white">Episodes</p>
              <button onClick={() => setOpenMenu(null)} className="text-white/40 hover:text-white transition-colors" aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Season selector — browse any season without leaving the player */}
            {(seasons?.length ?? 0) > 1 && (
              <div className="flex gap-1.5 px-3 pb-2 border-b border-white/10 flex-shrink-0 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                {seasons!.filter(s => s.episodeCount > 0).map(s => (
                  <button key={s.seasonNumber} onClick={() => setPanelSeason(s.seasonNumber)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${panelSeason === s.seasonNumber ? 'bg-[#06D6E0] text-black' : 'text-white/55 hover:text-white hover:bg-white/10'}`}>
                    Season {s.seasonNumber}
                  </button>
                ))}
              </div>
            )}

            <div className="overflow-y-auto p-2 min-h-0 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
              {panelEpisodes.map(ep => {
                const isCurrent = panelSeason === season && ep.episodeNumber === episode
                return (
                  <button key={ep.episodeNumber}
                    onClick={() => { if (!isCurrent && panelSeason != null) onEpisodeChange?.(panelSeason, ep.episodeNumber); setOpenMenu(null) }}
                    className={`w-full flex gap-3 p-2 rounded-xl text-left transition-colors ${isCurrent ? 'bg-[#06D6E0]/15' : 'hover:bg-white/5'}`}>
                    <div className="relative w-24 aspect-video rounded-lg overflow-hidden bg-white/5 flex-shrink-0 flex items-center justify-center">
                      {ep.stillUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={ep.stillUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        : <span className="text-white/30 text-xs font-semibold">E{ep.episodeNumber}</span>}
                      {isCurrent && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="#06D6E0"><path d="M7 4.5v15L20 12 7 4.5z"/></svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 py-0.5">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-[#06D6E0]' : 'text-white'}`}>{ep.episodeNumber}. {ep.name}</p>
                        {ep.runtime ? <span className="text-[10px] text-white/35 flex-shrink-0 ml-auto">{ep.runtime}m</span> : null}
                      </div>
                      {ep.overview && <p className="text-[11px] text-white/40 leading-snug line-clamp-2 mt-0.5">{ep.overview}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Online-subtitles picker — compact, auto-loaded, sorted A→Z */}
      {openMenu === 'ossearch' && (
        <>
          <div className="fixed inset-0 z-40" onPointerDown={() => setOpenMenu(null)} />
          <div className="absolute bottom-16 right-3 sm:right-5 z-50 w-72 max-h-[62%] bg-[#111]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
              <p className="text-[10px] text-white/30 uppercase tracking-widest">OpenSubtitles</p>
              <div className="flex items-center gap-2">
                <button onClick={() => searchAllSubtitles()} disabled={osLoading} title="Refresh"
                  className="text-white/40 hover:text-white disabled:opacity-40 transition-colors">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                </button>
                <button onClick={() => { setOpenMenu('settings'); setSettingsTab('subs') }} className="text-white/40 hover:text-white text-[11px] font-medium transition-colors">Back</button>
              </div>
            </div>

            {/* Results */}
            <div className="overflow-y-auto px-2 pb-2 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
              {osLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-[#06D6E0] animate-spin" />
                </div>
              )}
              {osError && <p className="text-red-400 text-xs text-center py-6 px-4">{osError}</p>}
              {!osLoading && osSearched && osResults.length === 0 && !osError && (
                <p className="text-white/30 text-xs text-center py-6">No subtitles found</p>
              )}
              {!osLoading && osResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => pickOsSubtitle(r)}
                  className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-white/10 transition-colors flex items-center gap-2.5"
                >
                  {r.flag ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.flag} alt="" className="w-6 h-4 rounded-sm flex-shrink-0 object-cover shadow" />
                  ) : <span className="w-6 h-4 rounded-sm bg-white/10 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-white/90 text-[13px] font-medium truncate">{r.display}</span>
                      {r.origin && <span className="text-[7px] tracking-wide bg-[#06D6E0]/15 text-[#06D6E0] px-1 py-0.5 rounded uppercase flex-shrink-0">{r.origin}</span>}
                      {r.hi && <span className="text-[7px] tracking-wide bg-white/10 text-white/45 px-1 py-0.5 rounded uppercase flex-shrink-0">HI</span>}
                    </div>
                    {r.release && <p className="text-[10px] text-white/35 truncate leading-tight">{r.release}</p>}
                  </div>
                  {r.downloads ? (
                    <span className="text-[9px] text-white/30 flex-shrink-0 flex items-center gap-0.5" title={`${r.downloads.toLocaleString()} downloads`}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/></svg>
                      {r.downloads >= 1e6 ? `${(r.downloads / 1e6).toFixed(1)}M` : r.downloads >= 1e3 ? `${Math.round(r.downloads / 1e3)}K` : r.downloads}
                    </span>
                  ) : null}
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
  const isMobile = useIsMobile()

  // Mobile: bottom sheet portaled to <body> so nothing clips or stacks over it.
  if (isMobile && typeof document !== 'undefined') {
    return createPortal(
      <>
        <div className="fixed inset-0 z-[998] bg-black/60" onPointerDown={e => { e.stopPropagation(); onClose() }} />
        <div className="fixed inset-x-0 bottom-0 z-[999] max-h-[80vh] bg-[#111]/97 backdrop-blur-xl border-t border-white/10 rounded-t-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/20 flex-shrink-0" />
          <p className="text-[11px] text-white/40 uppercase tracking-widest px-4 pt-2 pb-1 flex-shrink-0">{label}</p>
          <div className="overflow-y-auto pb-3 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
            {children}
          </div>
        </div>
      </>,
      document.body,
    )
  }

  // Desktop: original anchored dropdown (unchanged).
  return (
    <>
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
