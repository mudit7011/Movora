import { api } from '@/lib/api'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { Source } from '@/types/movie'
import WatchClient from './WatchClient'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const movie = await api.getMovie(params.slug).catch(() => null)
  if (!movie) return { title: 'Watch — Movora' }
  return { title: `Watch ${movie.title} — Movora` }
}

export default async function WatchPage({ params }: Props) {
  const movie = await api.getMovie(params.slug).catch(() => null)
  if (!movie) notFound()

  const id = movie.tmdbId.replace(/^movie_/, '')
  const sources: Source[] = [
    { serverName: 'Server 1', url: `https://player.videasy.to/movie/${id}?color=06D6E0&autoplay=1&overlay=true`,   type: 'iframe', quality: 'HD', isWorking: true },
    { serverName: 'Server 2', url: `https://vidlink.pro/movie/${id}?primaryColor=06D6E0&autoplay=true`, type: 'iframe', quality: 'HD', isWorking: true },
    { serverName: 'Server 3', url: `https://embedmaster.link/fljq7ku6ysokw3og/movie/${id}`, type: 'iframe', quality: 'HD', isWorking: true },
    { serverName: 'Server 4', url: `https://nhdapi.com/embed/movie/${id}?autoplay=true&autonext=false&lang=Hindi&audio=true&title=true&download=true&setting=true&appearance=on&watchparty=false&chromecast=true&pip=true&nextbutton=false&hidecontrols=false&primarycolor=06D6E0&secondarycolor=0891B2&iconcolor=FFFFFF&iconsize=1&font=Poppins&fontcolor=FFFFFF&fontsize=20&opacity=0.50&glasscolor=000000&glassopacity=65&glassblur=20&subtitle=Off&subdelay=0&subtextsize=45&subtextcolor=FFFFFF&subcapitalize=false&subbold=false&subfont=Roboto&subbgenabled=false&subbgcolor=000000&subbgopacity=0&subbgblur=0`, type: 'iframe', quality: 'HD', isWorking: true },
  ]

  // Pre-warm EmbedMaster sources in background (fire and forget)
  fetch(`https://embedmaster.com/json/movie/check/${id}`).catch(() => {})

  const related = await api.getRelated(movie.slug).catch(() => ({ similar: [], youMayLove: [] }))

  return <WatchClient movie={movie} sources={sources} related={related} />
}
