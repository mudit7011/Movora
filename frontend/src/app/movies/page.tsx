import { api } from '@/lib/api'
import MovieCard from '@/components/MovieCard'
import FilterSidebar from '@/components/FilterSidebar'
import { Suspense } from 'react'
import type { MovieFilters } from '@/types/movie'

interface Props {
  searchParams: MovieFilters
}

export const metadata = { title: 'Browse Movies — Movora' }

async function MovieGrid({ filters }: { filters: MovieFilters }) {
  const data = await api.getMovies(filters).catch(() => ({ movies: [], total: 0, page: 1, pages: 1 }))

  if (data.movies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted">
        <span className="text-5xl mb-4">🎬</span>
        <p className="text-lg font-medium">No movies found</p>
        <p className="text-sm mt-1">Try adjusting your filters</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
      {data.movies.map(movie => (
        <MovieCard key={movie._id} movie={movie} />
      ))}
    </div>
  )
}

export default function MoviesPage({ searchParams }: Props) {
  return (
    <div className="min-h-screen pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Browse Movies</h1>
          <Suspense>
            <FilterSidebar />
          </Suspense>
        </div>

        <div className="flex gap-8">
          <Suspense>
            <FilterSidebar />
          </Suspense>
          <div className="flex-1 min-w-0">
            <Suspense fallback={<div className="text-muted text-sm">Loading…</div>}>
              <MovieGrid filters={searchParams} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}
