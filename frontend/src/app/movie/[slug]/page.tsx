// Long-tail detail pages: only ~250 real slugs, but ~2.5K distinct URLs get hit
// (stale Google-indexed links + bots). ISR was writing a cache entry for every
// dead slug — 5.1K writes/12h vs ~190 reads. Render dynamically instead: zero ISR
// writes, new movies work instantly (no redeploy), and Cloudflare's 2h edge cache
// (same rule as /watch) absorbs repeat hits before they reach Vercel.
export const dynamic = 'force-dynamic'

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
