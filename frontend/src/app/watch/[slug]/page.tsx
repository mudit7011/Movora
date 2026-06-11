export const revalidate = 3600

import { cache, Suspense } from 'react'
import { api } from '@/lib/api'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { Source, Movie } from '@/types/movie'
import MovieCard from '@/components/MovieCard'
import WatchClient from './WatchClient'

interface Props {
  params: { slug: string }
}

const getMovie   = cache((slug: string) => api.getMovie(slug).catch(() => null))
const getRelated = cache((slug: string) => api.getRelated(slug).catch((e) => { console.error('[RelatedSection] fetch failed:', e); return { similar: [], youMayLove: [] } }))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const movie = await getMovie(params.slug)
  if (!movie) return { title: 'Watch — Movora' }
  return {
    title: `Watch ${movie.title} — Movora`,
    alternates: { canonical: `https://watchmovora.com/watch/${params.slug}` },
  }
}

export async function generateStaticParams() {
  try {
    const movies = await api.getLatest()
    return movies.slice(0, 200).map(m => ({ slug: m.slug }))
  } catch {
    return []
  }
}

export default async function WatchPage({ params }: Props) {
  // Only getMovie() is in the critical path — page HTML streams as soon as this resolves.
  const movie = await getMovie(params.slug)
  if (!movie) notFound()

  const id = movie.tmdbId.replace(/^movie_/, '')
  const sources: Source[] = [
    { serverName: 'Server 1', url: `https://player.videasy.to/movie/${id}?color=06D6E0&autoplay=1`,   type: 'iframe', quality: 'HD', isWorking: true },
    { serverName: 'Server 2', url: `https://vidlink.pro/movie/${id}?primaryColor=06D6E0&autoplay=true`, type: 'iframe', quality: 'HD', isWorking: true },
    { serverName: 'Server 3', url: `https://embedmaster.link/fljq7ku6ysokw3og/movie/${id}`, type: 'iframe', quality: 'HD', isWorking: true },
    { serverName: 'Server 4', url: `https://ezvidapi.com/embed/movie/${id}?provider=vidrock`, type: 'iframe', quality: 'HD', isWorking: true },
    { serverName: 'Server 5', url: `https://nhdapi.com/embed/movie/${id}?autoplay=true&autonext=false&audio=true&lang=English&title=true&download=true&setting=true&appearance=true&watchparty=false&chromecast=true&pip=true&nextbutton=false&hidecontrols=false&hideserver=true&hideservericon=true&icons=sharp&logo=https://watchmovora.com/icon.svg&logowidth=36px&logoheight=36px&primarycolor=06D6E0&secondarycolor=0891B2&iconcolor=FFFFFF&iconsize=1&font=Poppins&fontcolor=FFFFFF&fontsize=20&opacity=0.50&glasscolor=000000&glassopacity=65&glassblur=20&subtitle=Off&subdelay=0&subtextsize=140&subtextcolor=FFFFFF&subcapitalize=false&subbold=false&subfont=Roboto&subbgenabled=false&subbgcolor=000000&subbgopacity=0&subbgblur=0`, type: 'iframe', quality: 'HD', isWorking: true },
  ]

  return (
    <WatchClient movie={movie} sources={sources}>
      <Suspense fallback={<RelatedSkeleton />}>
        <RelatedSection slug={params.slug} />
      </Suspense>
    </WatchClient>
  )
}

// Async server component — runs independently after page HTML has already streamed.
async function RelatedSection({ slug }: { slug: string }) {
  const related = await getRelated(slug)
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
