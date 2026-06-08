import { api } from '@/lib/api'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { Source } from '@/types/movie'
import WatchClient from './WatchClient'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const movie = await api.getMovie(params.slug).catch(() => null)
  if (!movie) return { title: 'Watch — Movora' }
  return { title: `Watch ${movie.title} — Movora` }
}

export default async function WatchPage({ params }: Props) {
  const movie = await api.getMovie(params.slug).catch(() => null)
  if (!movie) notFound()

  const id = movie.tmdbId.replace(/^movie_/, '')
  const sources: Source[] = [
    { serverName: 'Server 1', url: `https://player.videasy.to/movie/${id}?color=06D6E0&autoplay=1&overlay=true`,   type: 'iframe', quality: 'HD', isWorking: true },
    { serverName: 'Server 2', url: `https://vidlink.pro/movie/${id}?primaryColor=06D6E0&autoplay=true`, type: 'iframe', quality: 'HD', isWorking: true },
    { serverName: 'Server 3', url: `https://embedmaster.link/fljq7ku6ysokw3og/movie/${id}`, type: 'iframe', quality: 'HD', isWorking: true },
    { serverName: 'Server 4', url: `https://cinesrc.st/embed/movie/${id}?autoplay=true&color=%2306D6E0&quality=1080`, type: 'iframe', quality: 'HD', isWorking: true },
    { serverName: 'Hindi', url: `https://nhdapi.com/embed/movie/${id}?autoplay=true&lang=Hindi&primarycolor=06D6E0&secondarycolor=0891B2&iconcolor=FFFFFF&glasscolor=000000&glassopacity=80&glassblur=20&fontcolor=FFFFFF&subtitle=Off`, type: 'iframe', quality: 'HD', isWorking: true },
  ]

  // Pre-warm EmbedMaster sources in background (fire and forget)
  fetch(`https://embedmaster.com/json/movie/check/${id}`).catch(() => {})

  const related = await api.getRelated(movie.slug).catch(() => ({ similar: [], youMayLove: [] }))

  return <WatchClient movie={movie} sources={sources} related={related} />
}
