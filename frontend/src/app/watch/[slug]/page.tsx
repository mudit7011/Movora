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
    { serverName: 'Server 1', url: `https://player.videasy.net/movie/${id}?color=06D6E0&autoplay=1`,   type: 'iframe', quality: 'HD', isWorking: true },
    { serverName: 'Server 2', url: `https://vidlink.pro/movie/${id}`,          type: 'iframe', quality: 'HD', isWorking: true },
    { serverName: 'Server 3', url: `https://embedmaster.link/movie/${id}`,     type: 'iframe', quality: 'HD', isWorking: true },
  ]

  const related = await api.getRelated(movie.slug).catch(() => ({ similar: [], youMayLove: [] }))

  return <WatchClient movie={movie} sources={sources} related={related} />
}
