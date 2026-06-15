// Watch pages are deep long-tail (almost always an ISR MISS), so ISR only added
// write cost with no cache-hit benefit. Render dynamically instead — the underlying
// show data fetch is still cached 1h at the data layer (CACHE.SHOW), so backend
// load is unchanged and ISR writes drop to ~zero.
export const dynamic = 'force-dynamic'

import { cache, Suspense } from 'react'
import { api } from '@/lib/api'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { Movie } from '@/types/movie'
import MovieCard from '@/components/MovieCard'
import WatchShowClient from './WatchShowClient'

interface Props {
  params: Promise<{ slug: string }>
}

const getShow         = cache((slug: string) => api.getShow(slug).catch(() => null))
const getRelatedShows = cache((slug: string) => api.getRelatedShows(slug).catch((e) => { console.error('[RelatedSection] shows fetch failed:', e); return { similar: [], youMayLove: [] } }))

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

  // Only getShow() is in the critical path — page HTML streams as soon as this resolves.
  const show = await getShow(slug)
  if (!show) notFound()

  // Season/episode come from the URL query string. Reading searchParams here
  // would opt the route out of Full Route Cache (one CDN miss per unique URL).
  // WatchShowClient reads them via useSearchParams() on the client,
  // keeping this server component fully cacheable at the slug level.
  return (
    <Suspense fallback={<ShowWatchSkeleton />}>
      <WatchShowClient show={show}>
        <Suspense fallback={<RelatedSkeleton />}>
          <RelatedSection slug={slug} />
        </Suspense>
      </WatchShowClient>
    </Suspense>
  )
}

// Async server component — runs independently after page HTML has already streamed.
async function RelatedSection({ slug }: { slug: string }) {
  const related = await getRelatedShows(slug)
  if (!related.similar.length && !related.youMayLove.length) return null
  return (
    <>
      {related.similar.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-4">More Like This</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {related.similar.slice(0, 12).map((m: Movie) => (
              <MovieCard key={m._id} movie={m} />
            ))}
          </div>
        </div>
      )}
      {related.youMayLove.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-4">You May Also Love</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {related.youMayLove.slice(0, 12).map((m: Movie) => (
              <MovieCard key={m._id} movie={m} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function RelatedSkeleton() {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="h-3 w-24 rounded bg-white/10 animate-pulse mb-4" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="w-full rounded-xl bg-white/[0.06] animate-pulse" style={{ aspectRatio: '2/3' }} />
            <div className="h-2.5 w-3/4 rounded bg-white/[0.06] animate-pulse" />
            <div className="h-2 w-1/2 rounded bg-white/[0.04] animate-pulse" />
          </div>
        ))}
      </div>
    </div>
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
