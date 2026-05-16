import { api } from '@/lib/api'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import RatingBadge from '@/components/RatingBadge'
import GenreChip from '@/components/GenreChip'
import type { Metadata } from 'next'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const movie = await api.getMovie(params.slug).catch(() => null)
  if (!movie) return { title: 'Movie — Movora' }
  return {
    title: `${movie.title} — Movora`,
    description: movie.synopsis,
  }
}

export default async function MovieDetailPage({ params }: Props) {
  const movie = await api.getMovie(params.slug).catch(() => null)
  if (!movie) notFound()

  const workingSources = movie.sources.filter(s => s.isWorking)

  return (
    <div className="min-h-screen">
      <div className="relative h-[50vh] sm:h-[60vh] w-full">
        {movie.backdropUrl && (
          <Image
            src={movie.backdropUrl}
            alt={movie.title}
            fill
            priority
            sizes="100vw"
            className="object-cover object-top"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-base via-base/80 to-base/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-base to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-36 sm:-mt-48 pb-16">
        <div className="flex flex-col sm:flex-row gap-8">
          <div className="flex-shrink-0 w-44 sm:w-56">
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden ring-1 ring-white/10 shadow-2xl">
              {movie.posterUrl ? (
                <Image src={movie.posterUrl} alt={movie.title} fill sizes="224px" className="object-cover" />
              ) : (
                <div className="w-full h-full bg-white/5" />
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0 pt-2">
            <h1 className="font-display text-4xl sm:text-5xl text-white tracking-wide mb-3">
              {movie.title}
            </h1>

            {movie.titleHindi && (
              <p className="text-muted text-lg mb-3">{movie.titleHindi}</p>
            )}

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <RatingBadge rating={movie.rating} />
              <span className="text-muted text-sm">{movie.releaseYear}</span>
              <span className="text-muted text-sm">{movie.runtime} min</span>
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              {movie.genres.map(g => <GenreChip key={g} genre={g} />)}
              {movie.language.map(l => (
                <span key={l} className="text-xs font-medium text-gold bg-gold/10 border border-gold/20 px-2 py-0.5 rounded-full">
                  {l}
                </span>
              ))}
            </div>

            <p className="text-white/75 text-sm leading-relaxed max-w-xl mb-8">
              {movie.synopsis}
            </p>

            {workingSources.length > 0 && (
              <Link
                href={`/watch/${movie.slug}`}
                className="inline-flex items-center gap-2 bg-crimson hover:bg-crimson-dark text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-colors shadow-crimson-glow"
              >
                ▶ Watch Now
              </Link>
            )}
          </div>
        </div>

        {movie.cast.length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-semibold mb-4">Cast</h2>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
              {movie.cast.slice(0, 10).map((member, i) => (
                <div key={i} className="flex-shrink-0 text-center w-20">
                  <div className="w-16 h-16 mx-auto rounded-full overflow-hidden bg-white/10 ring-1 ring-white/10 mb-2">
                    {member.photo ? (
                      <Image src={member.photo} alt={member.name} width={64} height={64} className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl text-muted">
                        {member.name[0]}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-white font-medium line-clamp-1">{member.name}</p>
                  {member.character && (
                    <p className="text-xs text-muted line-clamp-1">{member.character}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {movie.trailerKey && (
          <div className="mt-12">
            <h2 className="text-lg font-semibold mb-4">Trailer</h2>
            <div className="relative aspect-video max-w-2xl rounded-xl overflow-hidden">
              <iframe
                src={`https://www.youtube.com/embed/${movie.trailerKey}`}
                title={`${movie.title} Trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
                sandbox="allow-scripts allow-same-origin allow-presentation"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
