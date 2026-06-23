// Pages are built once at deploy time and served forever from CDN.
// Revalidation is skipped to avoid ISR write charges; redeploy to pick up new content.
export const revalidate = false

import { cache } from 'react'
import { api } from '@/lib/api'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Sidebar from '@/components/Sidebar'
import ShowDetailClient from '@/components/ShowDetailClient'

interface Props {
  params: Promise<{ slug: string }>
}

const getShow = cache((slug: string) => api.getShow(slug).catch(() => null))

export async function generateStaticParams() {
  try {
    const [p1, p2] = await Promise.all([
      api.getShows({ page: '1', limit: '100' }),
      api.getShows({ page: '2', limit: '100' }),
    ])
    const all = [...(p1.movies ?? []), ...(p2.movies ?? [])]
    return all.map(s => ({ slug: s.slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const show = await getShow(slug)
  if (!show) return { title: 'TV Show — Movora' }
  return {
    title: `${show.title} — Movora`,
    description: show.synopsis,
    alternates: { canonical: `https://watchmovora.com/show/${slug}` },
    openGraph: {
      title: `${show.title} — Movora`,
      description: show.synopsis,
      images: show.backdropUrl ? [show.backdropUrl] : [],
    },
  }
}

export default async function ShowDetailPage({ params }: Props) {
  const { slug } = await params
  const show = await getShow(slug)
  if (!show) notFound()

  return (
    <>
      <Sidebar />
      <ShowDetailClient show={show} />
    </>
  )
}
