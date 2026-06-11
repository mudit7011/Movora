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

export default function EzvidPlayer({ tmdbId, type, season, episode, title, poster, backdrop, synopsis, startAt }: Props) {
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
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
      )}
      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-center px-10 max-w-2xl">
        {title && (
          <h2 className="text-white text-3xl font-bold drop-shadow-xl mb-3 leading-tight">{title}</h2>
        )}
        {synopsis && (
          <p className="text-white/70 text-sm leading-relaxed line-clamp-4">{synopsis}</p>
        )}
      </div>

      {/* Spinner */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-12 h-12 border-[3px] border-white/10 border-t-[#06D6E0] rounded-full animate-spin" />
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
      poster={poster}
      externalSubtitles={stream.subtitles}
      startAt={startAt}
      tmdbId={tmdbId}
      mediaType={type}
      season={season}
      episode={episode}
    />
  )
}
