'use client'

import { useEffect, useState, useRef, use, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Hls from 'hls.js'
import Sidebar from '@/components/Sidebar'

const SPORTS_PROXY = '/api/sports/proxy'  // reuse the existing generic HLS proxy

// base64url → string (channel id encodes the stream URL, so no server lookup needed)
function decodeId(id: string): string {
  try {
    let s = id.replace(/-/g, '+').replace(/_/g, '/')
    while (s.length % 4) s += '='
    return atob(s)
  } catch {
    return ''
  }
}

function proxied(url: string) {
  return `${SPORTS_PROXY}?url=${encodeURIComponent(url)}&referer=`
}

export default function LiveTvWatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const router = useRouter()
  const name = searchParams.get('name') || 'Live Channel'
  const streamUrl = decodeId(decodeURIComponent(id))

  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [levels, setLevels] = useState<{ index: number; height: number }[]>([])
  const [currentLevel, setCurrentLevel] = useState(-1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback((src: string) => {
    const video = videoRef.current
    if (!video) return

    if (hlsRef.current) { try { hlsRef.current.destroy() } catch { /* */ } hlsRef.current = null }
    setLevels([]); setCurrentLevel(-1); setLoading(true); setError('')

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true, liveSyncDurationCount: 3, backBufferLength: 30 })
      hlsRef.current = hls
      hls.loadSource(src)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLevels(hls.levels.map((l, i) => ({ index: i, height: l.height || 0 })))
        setLoading(false)
        video.play().catch(() => {})
      })
      hls.on(Hls.Events.LEVEL_SWITCHED, (_, d) => setCurrentLevel(d.level))
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) { try { hls.startLoad() } catch { /* */ } }
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) { try { hls.recoverMediaError() } catch { /* */ } }
        else setError('This channel is offline right now. Try another.')
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      video.play().catch(() => {})
      setLoading(false)
    } else {
      setError('HLS not supported in this browser.')
    }
  }, [streamUrl])

  useEffect(() => {
    if (!streamUrl) { setError('Invalid channel.'); setLoading(false); return }
    // Proxy through Render (Singapore): many channels are geo-locked from the viewer's
    // country but reachable from Render, so proxy-first is the only reliable path.
    load(proxied(streamUrl))
    return () => { if (hlsRef.current) { try { hlsRef.current.destroy() } catch { /* */ } hlsRef.current = null } }
  }, [streamUrl, load])

  const switchLevel = (lvl: number) => { if (hlsRef.current) hlsRef.current.currentLevel = lvl; setCurrentLevel(lvl) }

  return (
    <>
      <Sidebar />
      <div className="min-h-screen pb-24 lg:pb-8 pt-[calc(0.75rem_+_env(safe-area-inset-top))] px-4 sm:px-6 lg:pl-28 lg:pr-8">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.07] transition-all"
          >
            <svg className="w-4 h-4 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm font-semibold text-white/80 truncate">{name}</h1>
            <span className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
          </div>
        </div>

        <div className="relative w-full rounded-2xl overflow-hidden bg-black border border-white/[0.07]" style={{ aspectRatio: '16/9' }}>
          {loading && !error && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/80 pointer-events-none">
              <div className="w-14 h-14 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-white/60">Connecting to channel…</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/90">
              <div className="text-3xl">📡</div>
              <p className="text-sm text-white/50 text-center px-8">{error}</p>
              <button onClick={() => router.back()} className="px-4 py-2 rounded-xl bg-white/10 text-sm text-white/60 hover:bg-white/15 transition-all">
                Back to channels
              </button>
            </div>
          )}
          {levels.length > 1 && !loading && (
            <div className="absolute top-3 right-3 z-20">
              <select
                value={currentLevel}
                onChange={e => switchLevel(Number(e.target.value))}
                className="bg-black/70 text-white text-xs rounded-lg px-2 py-1 border border-white/10 backdrop-blur-sm cursor-pointer"
              >
                <option value={-1}>Auto</option>
                {[...levels].sort((a, b) => b.height - a.height).map(l => (
                  <option key={l.index} value={l.index}>{l.height ? `${l.height}p` : `Level ${l.index}`}</option>
                ))}
              </select>
            </div>
          )}
          <video ref={videoRef} controls playsInline autoPlay className="absolute inset-0 w-full h-full" style={{ background: '#000' }} />
        </div>

        <p className="mt-4 text-[11px] text-white/20 text-center">
          Live channels can drop or change programming without notice. If one doesn&apos;t load, try another.
        </p>
      </div>
    </>
  )
}
