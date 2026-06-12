export const revalidate = 86400

import { cache } from 'react'
import { api } from '@/lib/api'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Sidebar from '@/components/Sidebar'
import MovieDetailClient from '@/components/MovieDetailClient'

interface Props {
  params: Promise<{ slug: string }>
}

const getMovie = cache((slug: string) => api.getMovie(slug).catch(() => null))

export async function generateStaticParams() {
  try {
    const movies = await api.getLatest()
    return movies.slice(0, 200).map(m => ({ slug: m.slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const movie = await getMovie(slug)
  if (!movie) return { title: 'Movie — Movora' }
  return {
    title: `${movie.title} — Movora`,
    description: movie.synopsis,
    alternates: { canonical: `https://watchmovora.com/movie/${slug}` },
    openGraph: {
      title: `${movie.title} — Movora`,
      description: movie.synopsis,
      images: movie.backdropUrl ? [movie.backdropUrl] : [],
    },
  }
}

export default async function MovieDetailPage({ params }: Props) {
  const { slug } = await params
  const movie = await getMovie(slug)
  if (!movie) notFound()

  return (
    <>
      <Sidebar />
      <MovieDetailClient movie={movie} />
    </>
  )
}
