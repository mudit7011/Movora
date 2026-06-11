'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

const VideoPlayer = dynamic(() => import('./VideoPlayer'), { ssr: false })

interface EzvidSubtitle { label: string; language: string; url: string; default: boolean }
interface EzvidStream { stream_url: string; subtitles: EzvidSubtitle[] }

interface Props {
  tmdbId: string
  type: 'movie' | 'tv'
  season?: number
  episode?: number
  title?: string
  poster?: string
  backdrop?: string
  synopsis?: string
  startAt?: number
  year?: number
  runtime?: number
  rating?: number
}

const PROVIDERS = ['vidrock', 'vidzee', 'vidnest', 'popr', 'vidlink', 'icefy', 'vixsrc']

async function fetchStream(tmdbId: string, type: 'movie' | 'tv', season?: number, episode?: number): Promise<EzvidStream | null> {
  for (const provider of PROVIDERS) {
    try {
      const url = type === 'movie'
        ? `https://api.ezvidapi.com/movie/${provider}/${tmdbId}`
        : `https://api.ezvidapi.com/tv/${provider}/${tmdbId}?season=${season}&episode=${episode}`
      const res = await fetch(url)
      if (!res.ok) continue
      const data = await res.json()
      if (data?.stream_url) return { stream_url: data.stream_url, subtitles: data.subtitles ?? [] }
    } catch { continue }
  }
  return null
}

function formatRuntime(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`
}

export default function EzvidPlayer({ tmdbId, type, season, episode, title, poster, backdrop, synopsis, startAt, year, runtime, rating }: Props) {
  const [stream, setStream] = useState<EzvidStream | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setLoading(true)
    setFailed(false)
    setStream(null)
    fetchStream(tmdbId, type, season, episode).then(s => {
      if (s) setStream(s)
      else setFailed(true)
      setLoading(false)
    })
  }, [tmdbId, type, season, episode])

  if (loading) return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Backdrop */}
      {(backdrop || poster) && (
        <img
          src={backdrop || poster}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center opacity-60"
          style={{ filter: 'brightness(0.75)' }}
        />
      )}
      {/* Gradients */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />

      {/* Info — bottom-left, Netflix style */}
      <div className="absolute bottom-0 left-0 px-6 pb-6 sm:px-10 sm:pb-8 max-w-xl">
        {title && (
          <h2 className="text-white font-black leading-none mb-3 drop-shadow-2xl"
            style={{ fontSize: 'clamp(1.75rem, 5vw, 3rem)', lineHeight: 1.05 }}>
            {title}
          </h2>
        )}

        {/* Meta row */}
        {(year || runtime || rating) && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {year && (
              <span className="text-white/70 text-sm font-medium">{year}</span>
            )}
            {runtime && runtime > 0 && (
              <>
                <span className="text-white/30">·</span>
                <span className="text-white/70 text-sm font-medium">{formatRuntime(runtime)}</span>
              </>
            )}
            {rating && rating > 0 && (
              <>
                <span className="text-white/30">·</span>
                <span className="flex items-center gap-1 text-sm font-medium text-amber-400">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  {rating.toFixed(1)}
                </span>
              </>
            )}
          </div>
        )}

        {synopsis && (
          <p className="text-white/60 text-sm leading-relaxed line-clamp-2 drop-shadow">{synopsis}</p>
        )}
      </div>

      {/* Spinner — centered */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-11 h-11 border-[3px] border-white/10 border-t-[#06D6E0] rounded-full animate-spin" />
      </div>
    </div>
  )

  if (failed || !stream) return (
    <div className="w-full h-full bg-black flex items-center justify-center">
      <p className="text-white/40 text-sm">Stream not available</p>
    </div>
  )

  return (
    <VideoPlayer
      src={stream.stream_url}
      title={title}
      poster={backdrop}
      externalSubtitles={stream.subtitles}
      startAt={startAt}
      tmdbId={tmdbId}
      mediaType={type}
      season={season}
      episode={episode}
      year={year}
      runtime={runtime}
      rating={rating}
      synopsis={synopsis}
    />
  )
}
