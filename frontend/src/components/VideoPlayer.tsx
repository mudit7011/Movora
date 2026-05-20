'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

interface QualityLevel { index: number; height: number; bitrate: number }
interface AudioTrack   { id: number; name: string }
interface SubTrack     { id: number; name: string }

interface Props {
  src: string       // .m3u8 or .mp4 direct URL
  title?: string
  poster?: string
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

type Menu = 'quality' | 'audio' | 'sub' | 'speed' | null

export default function VideoPlayer({ src, title, poster }: Props) {
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
          })

          hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_: any, d: any) => {
            setAudioTracks(d.audioTracks.map((t: any) => ({ id: t.id, name: t.name })))
            setCurAudio(hls.audioTrack)
          })

          hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_: any, d: any) => {
            setSubTracks(d.subtitleTracks.map((t: any) => ({ id: t.id, name: t.name })))
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
    const fn = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', fn)
    return () => document.removeEventListener('fullscreenchange', fn)
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
    if (document.fullscreenElement) document.exitFullscreen()
    else wrapRef.current?.requestFullscreen()
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
    if (hlsRef.current) hlsRef.current.subtitleTrack = id
    setCurSub(id)
    setOpenMenu(null)
  }

  function setPlaySpeed(s: number) {
    if (videoRef.current) videoRef.current.playbackRate = s
    setSpeed(s)
    setOpenMenu(null)
  }

  const progress     = duration > 0 ? (current / duration) * 100 : 0
  const bufPct       = duration > 0 ? (buffered / duration) * 100 : 0
  const qualLabel    = curQuality === -1 ? 'Auto' : (qualities[curQuality]?.height > 0 ? `${qualities[curQuality].height}p` : 'Auto')
  const ctrlVisible  = showCtrl || !playing

  return (
    <div
      ref={wrapRef}
      className="relative bg-black w-full h-full select-none overflow-hidden"
      onMouseMove={resetHide}
      onMouseLeave={() => { if (playing) setShowCtrl(false) }}
    >
      <video
        ref={videoRef}
        className="w-full h-full"
        poster={poster}
        playsInline
        onClick={togglePlay}
      />

      {/* Loading spinner */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-crimson animate-spin" />
        </div>
      )}

      {/* Controls */}
      <div
        className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${ctrlVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/30 pointer-events-none" />

        {/* Title */}
        {title && (
          <p className="relative px-5 pt-4 text-white font-semibold text-base drop-shadow line-clamp-1">{title}</p>
        )}

        {/* Seek bar */}
        <div className="relative px-4 pb-2 pt-6">
          <div
            ref={seekRef}
            className="relative h-[3px] hover:h-[5px] bg-white/25 rounded-full cursor-pointer transition-all duration-150 group"
            onClick={onSeekClick}
            onMouseMove={e => setHoverPct(getPct(e))}
            onMouseLeave={() => setHoverPct(null)}
          >
            {/* Buffered */}
            <div className="absolute inset-y-0 left-0 bg-white/30 rounded-full" style={{ width: `${bufPct}%` }} />
            {/* Progress */}
            <div className="absolute inset-y-0 left-0 bg-crimson rounded-full" style={{ width: `${progress}%` }} />
            {/* Thumb */}
            <div
              className="absolute top-1/2 w-3.5 h-3.5 -translate-y-1/2 -translate-x-1/2 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `${progress}%` }}
            />
            {/* Hover time tooltip */}
            {hoverPct !== null && duration > 0 && (
              <div
                className="absolute -top-8 -translate-x-1/2 bg-black/85 text-white text-xs px-2 py-0.5 rounded pointer-events-none whitespace-nowrap"
                style={{ left: `${hoverPct * 100}%` }}
              >
                {fmt(hoverPct * duration)}
              </div>
            )}
          </div>
        </div>

        {/* Bottom controls row */}
        <div className="relative flex items-center gap-2.5 px-4 pb-4">

          {/* Play/Pause */}
          <button onClick={togglePlay} className="text-white hover:text-white/80 transition-colors flex-shrink-0">
            {playing ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="3" width="4" height="18" rx="1.5" />
                <rect x="15" y="3" width="4" height="18" rx="1.5" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 4.5v15L20 12 7 4.5z" />
              </svg>
            )}
          </button>

          {/* Skip back/forward */}
          <button
            onClick={() => { if (videoRef.current) videoRef.current.currentTime -= 10 }}
            className="text-white/70 hover:text-white transition-colors flex-shrink-0"
            title="Rewind 10s"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5V2L7 7l5 5V8c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
              <text x="9" y="16" fontSize="6" fill="currentColor" stroke="none" fontFamily="sans-serif">10</text>
            </svg>
          </button>
          <button
            onClick={() => { if (videoRef.current) videoRef.current.currentTime += 10 }}
            className="text-white/70 hover:text-white transition-colors flex-shrink-0"
            title="Forward 10s"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5V2l5 5-5 5V8c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
              <text x="9" y="16" fontSize="6" fill="currentColor" stroke="none" fontFamily="sans-serif">10</text>
            </svg>
          </button>

          {/* Volume */}
          <div className="flex items-center gap-1.5 group/vol flex-shrink-0">
            <button
              onClick={() => { if (videoRef.current) videoRef.current.muted = !muted }}
              className="text-white/80 hover:text-white transition-colors"
            >
              {muted || volume === 0 ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : volume < 0.5 ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              )}
            </button>
            <input
              type="range" min="0" max="1" step="0.02"
              value={muted ? 0 : volume}
              onChange={e => {
                const val = parseFloat(e.target.value)
                if (videoRef.current) { videoRef.current.volume = val; videoRef.current.muted = val === 0 }
              }}
              className="w-0 group-hover/vol:w-20 transition-all duration-200 h-1 cursor-pointer accent-red-600 rounded-full"
            />
          </div>

          {/* Time */}
          <span className="text-white/70 text-xs font-mono flex-shrink-0">
            {fmt(current)} / {fmt(duration)}
          </span>

          <div className="flex-1" />

          {/* ── Right controls ── */}

          {/* Speed */}
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === 'speed' ? null : 'speed')}
              className="text-white/60 hover:text-white text-xs font-bold px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
            >
              {speed}×
            </button>
            {openMenu === 'speed' && (
              <Menu label="Speed" onClose={() => setOpenMenu(null)}>
                {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(s => (
                  <MenuItem key={s} active={speed === s} onClick={() => setPlaySpeed(s)}>
                    {s === 1 ? 'Normal' : `${s}×`}
                  </MenuItem>
                ))}
              </Menu>
            )}
          </div>

          {/* Subtitles */}
          {subTracks.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === 'sub' ? null : 'sub')}
                className={`text-xs font-bold px-2 py-0.5 rounded border transition-colors ${curSub >= 0 ? 'text-crimson border-crimson/50 bg-crimson/10' : 'text-white/60 border-white/20 hover:text-white hover:border-white/40'}`}
              >
                CC
              </button>
              {openMenu === 'sub' && (
                <Menu label="Subtitles" onClose={() => setOpenMenu(null)}>
                  <MenuItem active={curSub === -1} onClick={() => setSub(-1)}>Off</MenuItem>
                  {subTracks.map(t => (
                    <MenuItem key={t.id} active={curSub === t.id} onClick={() => setSub(t.id)}>{t.name}</MenuItem>
                  ))}
                </Menu>
              )}
            </div>
          )}

          {/* Audio */}
          {audioTracks.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === 'audio' ? null : 'audio')}
                className="text-white/60 hover:text-white transition-colors"
                title="Audio language"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
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
            <button
              onClick={() => setOpenMenu(openMenu === 'quality' ? null : 'quality')}
              className="text-white/60 hover:text-white text-xs font-semibold transition-colors min-w-[36px] text-right"
            >
              {qualLabel}
            </button>
            {openMenu === 'quality' && (
              <Menu label="Quality" onClose={() => setOpenMenu(null)}>
                <MenuItem active={curQuality === -1} onClick={() => setQuality(-1)}>
                  Auto
                </MenuItem>
                {[...qualities].reverse().map(q => (
                  <MenuItem key={q.index} active={curQuality === q.index} onClick={() => setQuality(q.index)}>
                    {q.height > 0 ? `${q.height}p` : `Level ${q.index}`}
                  </MenuItem>
                ))}
              </Menu>
            )}
          </div>

          {/* Picture-in-Picture */}
          <button
            onClick={async () => {
              const v = videoRef.current
              if (!v) return
              try {
                if (document.pictureInPictureElement) await document.exitPictureInPicture()
                else await v.requestPictureInPicture()
              } catch { /* not supported */ }
            }}
            className="text-white/60 hover:text-white transition-colors"
            title="Picture in Picture (p)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <rect x="12" y="11" width="9" height="6" rx="1" fill="currentColor" stroke="none" />
            </svg>
          </button>

          {/* Fullscreen */}
          <button onClick={toggleFs} className="text-white/60 hover:text-white transition-colors" title="Fullscreen (f)">
            {fs ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Small helper components ────────────────────────────────────────────────────

function Menu({ label, children, onClose }: { label: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="absolute bottom-10 right-0 bg-[#111] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[130px]">
      <p className="text-[10px] text-white/30 uppercase tracking-widest px-4 pt-3 pb-1">{label}</p>
      {children}
      <div className="h-2" />
    </div>
  )
}

function MenuItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between w-full text-left px-4 py-2 text-sm transition-colors hover:bg-white/10 ${active ? 'text-crimson font-semibold' : 'text-white/70'}`}
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
