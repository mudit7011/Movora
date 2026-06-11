export const revalidate = 3600

import { cache, Suspense } from 'react'
import { api } from '@/lib/api'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import WatchShowClient from './WatchShowClient'

interface Props {
  params: Promise<{ slug: string }>
}

// React cache() deduplicates getShow between generateMetadata and the page —
// only one network request per slug per render.
const getShow        = cache((slug: string) => api.getShow(slug).catch(() => null))
const getRelatedShows = cache((slug: string) => api.getRelatedShows(slug).catch(() => ({ similar: [], youMayLove: [] })))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const show = await getShow(slug)
  if (!show) return { title: 'Watch — Movora' }
  return {
    title: `Watch ${show.title} — Movora`,
    alternates: { canonical: `https://watchmovora.com/watch/show/${slug}` },
  }
}

export default async function WatchShowPage({ params }: Props) {
  const { slug } = await params

  const [show, related] = await Promise.all([
    getShow(slug),
    getRelatedShows(slug),
  ])
  if (!show) notFound()

  // Season/episode come from the URL query string. Reading searchParams here
  // would opt the route out of Full Route Cache (one CDN miss per unique URL).
  // Instead, WatchShowClient reads them via useSearchParams() on the client,
  // keeping this server component fully cacheable at the slug level.
  return (
    <Suspense fallback={<ShowWatchSkeleton />}>
      <WatchShowClient show={show} related={related} />
    </Suspense>
  )
}

function ShowWatchSkeleton() {
  return (
    <div className="min-h-screen bg-background flex flex-col lg:pl-24">
      <div className="relative z-50 flex items-center gap-3 px-4 sm:px-6 lg:px-8 py-3 lg:py-4 border-b border-white/[0.06] bg-background/80 sticky top-0">
        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10" />
        <div className="flex-1">
          <div className="h-4 w-40 rounded bg-white/10 animate-pulse" />
          <div className="h-3 w-16 rounded bg-white/[0.06] animate-pulse mt-1" />
        </div>
      </div>
      <div className="w-full bg-black lg:max-w-6xl lg:mx-auto lg:px-8 lg:pt-6 lg:bg-transparent">
        <div className="lg:rounded-2xl lg:overflow-hidden lg:ring-1 lg:ring-white/10">
          <div className="w-full bg-black/60 animate-pulse" style={{ aspectRatio: '16/9' }} />
        </div>
      </div>
    </div>
  )
}
