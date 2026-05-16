import { api } from '@/lib/api'
import MovieCard from '@/components/MovieCard'
import SearchInput from '@/components/SearchInput'
import { Suspense } from 'react'

export const metadata = { title: 'Search — Movora' }

async function SearchResults({ q }: { q: string }) {
  if (!q.trim()) {
    return (
      <p className="text-center text-muted mt-16">Start typing to search for movies</p>
    )
  }

  const movies = await api.search(q).catch(() => [])

  if (movies.length === 0) {
    return (
      <div className="text-center mt-16">
        <p className="text-lg text-white">No results for <span className="text-crimson">&ldquo;{q}&rdquo;</span></p>
        <p className="text-muted text-sm mt-2">Try a different title or check the spelling</p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm text-muted mb-6">{movies.length} result{movies.length !== 1 ? 's' : ''} for &ldquo;{q}&rdquo;</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
        {movies.map(movie => (
          <MovieCard key={movie._id} movie={movie} />
        ))}
      </div>
    </div>
  )
}

interface Props {
  searchParams: { q?: string }
}

export default function SearchPage({ searchParams }: Props) {
  const q = searchParams.q ?? ''
  return (
    <div className="min-h-screen pt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense>
          <SearchInput />
        </Suspense>
        <div className="mt-10">
          <Suspense fallback={<p className="text-muted text-sm text-center mt-10">Searching…</p>}>
            <SearchResults q={q} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
