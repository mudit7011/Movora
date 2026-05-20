import { api } from '@/lib/api'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import WatchShowClient from './WatchShowClient'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ season?: string; episode?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const show = await api.getShow(slug).catch(() => null)
  if (!show) return { title: 'Watch — Movora' }
  return { title: `Watch ${show.title} — Movora` }
}

export default async function WatchShowPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = await searchParams

  const show = await api.getShow(slug).catch(() => null)
  if (!show) notFound()

  const season = Number(sp.season ?? 1)
  const episode = Number(sp.episode ?? 1)

  const related = await api.getRelatedShows(show.slug).catch(() => ({ similar: [], youMayLove: [] }))

  return <WatchShowClient show={show} initialSeason={season} initialEpisode={episode} related={related} />
}
