// Pages are built once at deploy time and served forever from CDN.
// Revalidation is skipped to avoid ISR write charges; redeploy to pick up new content.
export const revalidate = false

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
    const [p1, p2] = await Promise.all([
      api.getMovies({ page: '1', limit: '100' }),
      api.getMovies({ page: '2', limit: '100' }),
    ])
    const all = [...(p1.movies ?? []), ...(p2.movies ?? [])]
    return all.map(m => ({ slug: m.slug }))
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
