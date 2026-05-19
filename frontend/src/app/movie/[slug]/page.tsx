import { api } from '@/lib/api'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Sidebar from '@/components/Sidebar'
import MovieDetailClient from '@/components/MovieDetailClient'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const movie = await api.getMovie(slug).catch(() => null)
  if (!movie) return { title: 'Movie — Movora' }
  return {
    title: `${movie.title} — Movora`,
    description: movie.synopsis,
    openGraph: {
      title: `${movie.title} — Movora`,
      description: movie.synopsis,
      images: movie.backdropUrl ? [movie.backdropUrl] : [],
    },
  }
}

export default async function MovieDetailPage({ params }: Props) {
  const { slug } = await params
  const movie = await api.getMovie(slug).catch(() => null)
  if (!movie) notFound()

  return (
    <>
      <Sidebar />
      <MovieDetailClient movie={movie} />
    </>
  )
}
