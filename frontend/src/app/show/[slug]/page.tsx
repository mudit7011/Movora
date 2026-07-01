// Long-tail detail pages: only ~250 real slugs, but ~1.2K distinct URLs get hit
// (stale Google-indexed links + bots). ISR was writing a cache entry for every
// dead slug — 2.4K writes/12h vs ~110 reads. Render dynamically instead: zero ISR
// writes, new shows work instantly (no redeploy), and Cloudflare's 2h edge cache
// (same rule as /watch) absorbs repeat hits before they reach Vercel.
export const dynamic = 'force-dynamic'

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
