'use client'

import { useState } from 'react'
import MovieCard from '@/components/MovieCard'
import type { Movie } from '@/types/movie'

const PAGE_SIZE = 24

interface Person {
  id: number
  name: string
  photo: string | null
  biography: string | null
  birthday: string | null
  deathday: string | null
  placeOfBirth: string | null
  knownFor: string | null
  popularity: number | null
}

interface Props {
  person: Person | null
  results: Movie[]
  actorName: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function age(birthday: string, deathday?: string | null) {
  const end = deathday ? new Date(deathday) : new Date()
  const born = new Date(birthday)
  let a = end.getFullYear() - born.getFullYear()
  if (end < new Date(end.getFullYear(), born.getMonth(), born.getDate())) a--
  return a
}

export default function ActorClient({ person, results, actorName }: Props) {
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [bioExpanded, setBioExpanded] = useState(false)

  const shown = results.slice(0, visible)
  const hasMore = visible < results.length
  const bio = person?.biography

  return (
    <main className="min-h-screen bg-background lg:pl-24 px-4 sm:px-6 lg:px-8 py-8">
      {/* Actor header */}
      <div className="flex flex-col sm:flex-row gap-6 mb-10">
        {/* Photo */}
        <div className="flex-shrink-0 flex justify-center sm:block">
          {person?.photo ? (
            <img
              src={person.photo}
              alt={person.name}
              width={180}
              height={270}
              className="w-36 h-52 sm:w-44 sm:h-64 rounded-2xl object-cover ring-1 ring-white/10 shadow-xl"
            />
          ) : (
            <div className="w-36 h-52 sm:w-44 sm:h-64 rounded-2xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center text-4xl text-muted-foreground">
              {actorName[0]?.toUpperCase()}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3 flex-wrap mb-1 justify-center sm:justify-start">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{person?.name ?? actorName}</h1>
            {person?.knownFor && (
              <span className="mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                {person.knownFor}
              </span>
            )}
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3 mb-4 text-sm text-muted-foreground justify-center sm:justify-start">
            {person?.birthday && (
              <div>
                <span className="text-white/40 text-xs uppercase tracking-wider mr-1.5">Born</span>
                <span className="text-foreground/80">{formatDate(person.birthday)}</span>
                {!person.deathday && (
                  <span className="ml-1.5 text-white/40">· {age(person.birthday)} yrs</span>
                )}
              </div>
            )}
            {person?.deathday && (
              <div>
                <span className="text-white/40 text-xs uppercase tracking-wider mr-1.5">Died</span>
                <span className="text-foreground/80">{formatDate(person.deathday)}</span>
                {person.birthday && (
                  <span className="ml-1.5 text-white/40">· aged {age(person.birthday, person.deathday)}</span>
                )}
              </div>
            )}
            {person?.placeOfBirth && (
              <div>
                <span className="text-white/40 text-xs uppercase tracking-wider mr-1.5">From</span>
                <span className="text-foreground/80">{person.placeOfBirth}</span>
              </div>
            )}
            {results.length > 0 && (
              <div>
                <span className="text-white/40 text-xs uppercase tracking-wider mr-1.5">On Movora</span>
                <span className="text-foreground/80">{results.length} title{results.length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {/* Biography */}
          {bio && (
            <div>
              <p className={`text-sm text-muted-foreground leading-relaxed ${!bioExpanded ? 'line-clamp-4' : ''}`}>
                {bio}
              </p>
              {bio.length > 300 && (
                <button
                  onClick={() => setBioExpanded(v => !v)}
                  className="mt-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  {bioExpanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filmography */}
      {results.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg">No movies or shows found for this actor in our library.</p>
        </div>
      ) : (
        <>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Available on Movora
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {shown.map((movie) => (
              <MovieCard key={movie._id} movie={movie} />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-10">
              <button
                onClick={() => setVisible(v => v + PAGE_SIZE)}
                className="px-8 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/40 text-sm font-medium text-foreground transition-all"
              >
                Load More ({results.length - visible} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </main>
  )
}
