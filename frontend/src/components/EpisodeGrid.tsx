'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { Movie, EpisodeInfo } from '@/types/movie'

interface Props {
  show: Movie
  currentSeason: number
  currentEpisode: number
  onSelect: (season: number, episode: number) => void
  // When provided, changing the season only notifies the parent (no auto-navigation),
  // so the page's main "Watch" button can reflect the chosen season.
  onSeasonChange?: (season: number) => void
}

export default function EpisodeGrid({ show, currentSeason, currentEpisode, onSelect, onSeasonChange }: Props) {
  const [episodes, setEpisodes] = useState<EpisodeInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSeason, setSelectedSeason] = useState(currentSeason)

  const seasons = show.seasonData?.filter(s => s.seasonNumber > 0) ?? []
  const activeSeason = seasons.find(s => s.seasonNumber === selectedSeason)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setEpisodes([])
    api.getEpisodes(show.slug, selectedSeason)
      .then(data => { if (!cancelled) setEpisodes(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setEpisodes([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [show.slug, selectedSeason])

  const handleSeasonChange = (s: number) => {
    setSelectedSeason(s)
    if (onSeasonChange) onSeasonChange(s)
    else if (s !== currentSeason) onSelect(s, 1)
  }

  const episodeCount = activeSeason?.episodeCount ?? 0

  // Fallback: generate stub episodes from episodeCount if TMDB fetch failed
  const displayEpisodes: EpisodeInfo[] = episodes.length > 0
    ? episodes
    : Array.from({ length: episodeCount }, (_, i) => ({
        episodeNumber: i + 1,
        name: `Episode ${i + 1}`,
        overview: '',
        runtime: 0,
        stillUrl: '',
        airDate: '',
      }))

  return (
    <div>
      {/* Header: label + season dropdown */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
          Episodes
        </p>
        {seasons.length > 0 && (
          <select
            value={selectedSeason}
            onChange={(e) => handleSeasonChange(Number(e.target.value))}
            className="bg-white/5 border border-white/10 text-foreground text-sm rounded-xl px-3 py-1.5 outline-none focus:border-primary/40 cursor-pointer"
          >
            {seasons.map(s => (
              <option key={s.seasonNumber} value={s.seasonNumber} className="bg-background">
                {s.name || `Season ${s.seasonNumber}`}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Episode cards grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: Math.min(episodeCount || 6, 9) }).map((_, i) => (
            <div key={i} className="flex gap-3 p-3 rounded-xl bg-white/[0.03] animate-pulse">
              <div className="w-32 h-[72px] rounded-lg bg-white/5 flex-shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-2 bg-white/5 rounded w-1/3" />
                <div className="h-3 bg-white/5 rounded w-3/4" />
                <div className="h-2 bg-white/5 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {displayEpisodes.map((ep) => {
            const isPlaying = selectedSeason === currentSeason && ep.episodeNumber === currentEpisode
            return (
              <button
                key={ep.episodeNumber}
                onClick={() => onSelect(selectedSeason, ep.episodeNumber)}
                className={`flex gap-3 p-2.5 rounded-xl text-left transition-all duration-200 group ${
                  isPlaying
                    ? 'bg-primary/15 border border-primary/40 ring-1 ring-primary/20'
                    : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.07] hover:border-white/20'
                }`}
              >
                {/* Thumbnail */}
                <div className="relative w-32 h-[72px] rounded-lg overflow-hidden bg-card flex-shrink-0">
                  {ep.stillUrl ? (
                    <img
                      src={ep.stillUrl}
                      alt={ep.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-white/5 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white/20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5.14v14l11-7-11-7z" />
                      </svg>
                    </div>
                  )}

                  {/* Play overlay on hover */}
                  <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
                    isPlaying ? 'opacity-100 bg-primary/30' : 'opacity-0 group-hover:opacity-100 bg-black/50'
                  }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isPlaying ? 'bg-primary' : 'bg-white/80'
                    }`}>
                      <svg className={`w-3.5 h-3.5 ml-0.5 ${isPlaying ? 'text-background' : 'text-background'}`} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5.14v14l11-7-11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      isPlaying
                        ? 'bg-primary text-background'
                        : 'bg-white/10 text-muted-foreground'
                    }`}>
                      E{String(ep.episodeNumber).padStart(2, '0')}
                    </span>
                    {ep.runtime > 0 && (
                      <span className="text-[10px] text-muted-foreground">{ep.runtime}m</span>
                    )}
                  </div>
                  <p className={`text-xs font-semibold line-clamp-1 mb-1 ${
                    isPlaying ? 'text-primary' : 'text-foreground'
                  }`}>
                    {ep.name}
                  </p>
                  {ep.overview && (
                    <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {ep.overview}
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
