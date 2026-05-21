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

  const id = movie.tmdbId
  const sources: Source[] = [
    { serverName: 'Server 1', url: `https://player.videasy.net/movie/${id}`,      type: 'iframe', quality: 'HD',  isWorking: true },
    { serverName: 'Server 2', url: `https://vidsrc.xyz/embed/movie/${id}`,        type: 'iframe', quality: 'HD',  isWorking: true },
    { serverName: 'Server 3', url: `https://vidsrc.to/embed/movie/${id}`,         type: 'iframe', quality: 'HD',  isWorking: true },
    { serverName: 'Server 4', url: `https://vidlink.pro/movie/${id}`,             type: 'iframe', quality: 'HD',  isWorking: true },
  ]

  const related = await api.getRelated(movie.slug).catch(() => ({ similar: [], youMayLove: [] }))

  return <WatchClient movie={movie} sources={sources} related={related} />
}
