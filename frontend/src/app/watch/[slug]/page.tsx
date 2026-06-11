export const revalidate = 3600

import { cache } from 'react'
import { api } from '@/lib/api'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { Source } from '@/types/movie'
import WatchClient from './WatchClient'

interface Props {
  params: { slug: string }
}

// React cache() deduplicates these calls within a single render tree.
// Both generateMetadata and WatchPage call getMovie — this ensures only
// one network request is made per slug per request.
const getMovie  = cache((slug: string) => api.getMovie(slug).catch(() => null))
const getRelated = cache((slug: string) => api.getRelated(slug).catch(() => ({ similar: [], youMayLove: [] })))

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
  const [movie, related] = await Promise.all([
    getMovie(params.slug),
    getRelated(params.slug),
  ])
  if (!movie) notFound()

  const id = movie.tmdbId.replace(/^movie_/, '')
  const sources: Source[] = [
    { serverName: 'Server 1', url: `https://player.videasy.to/movie/${id}?color=06D6E0&autoplay=1`,   type: 'iframe', quality: 'HD', isWorking: true },
    { serverName: 'Server 2', url: `https://vidlink.pro/movie/${id}?primaryColor=06D6E0&autoplay=true`, type: 'iframe', quality: 'HD', isWorking: true },
    { serverName: 'Server 3', url: `https://embedmaster.link/fljq7ku6ysokw3og/movie/${id}`, type: 'iframe', quality: 'HD', isWorking: true },
    { serverName: 'Server 4', url: `https://ezvidapi.com/embed/movie/${id}?provider=vidrock`, type: 'iframe', quality: 'HD', isWorking: true },
    { serverName: 'Server 5', url: `https://nhdapi.com/embed/movie/${id}?autoplay=true&autonext=false&audio=true&lang=English&title=true&download=true&setting=true&appearance=true&watchparty=false&chromecast=true&pip=true&nextbutton=false&hidecontrols=false&hideserver=true&hideservericon=true&icons=sharp&logo=https://watchmovora.com/icon.svg&logowidth=36px&logoheight=36px&primarycolor=06D6E0&secondarycolor=0891B2&iconcolor=FFFFFF&iconsize=1&font=Poppins&fontcolor=FFFFFF&fontsize=20&opacity=0.50&glasscolor=000000&glassopacity=65&glassblur=20&subtitle=Off&subdelay=0&subtextsize=140&subtextcolor=FFFFFF&subcapitalize=false&subbold=false&subfont=Roboto&subbgenabled=false&subbgcolor=000000&subbgopacity=0&subbgblur=0`, type: 'iframe', quality: 'HD', isWorking: true },
  ]

  return <WatchClient movie={movie} sources={sources} related={related} />
}
