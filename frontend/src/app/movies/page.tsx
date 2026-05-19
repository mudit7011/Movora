import { api } from '@/lib/api'
import MovieCard from '@/components/MovieCard'
import FilterSidebar from '@/components/FilterSidebar'
import Sidebar from '@/components/Sidebar'
import { Suspense } from 'react'
import type { MovieFilters } from '@/types/movie'

interface Props {
  searchParams: Promise<MovieFilters>
}

export const metadata = { title: 'Browse Movies — Movora' }

async function MovieGrid({ filters }: { filters: MovieFilters }) {
  const data = await api.getMovies(filters).catch(() => ({ movies: [], total: 0, page: 1, pages: 1 }))

  if (data.movies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </div>
        <p className="text-lg font-medium text-foreground">No movies found</p>
        <p className="text-sm mt-1">Try adjusting your filters</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
      {data.movies.map(movie => (
        <MovieCard key={movie._id} movie={movie} />
      ))}
    </div>
  )
}

export default async function MoviesPage({ searchParams }: Props) {
  const filters = await searchParams
  return (
    <>
      <Sidebar />
      <div className="min-h-screen pt-8 pb-24 lg:pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:pl-28 lg:pr-8 py-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-8">Browse Movies</h1>

          <div className="flex flex-col lg:flex-row gap-8">
            <Suspense>
              <FilterSidebar />
            </Suspense>
            <div className="flex-1 min-w-0">
              <Suspense fallback={
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="aspect-[2/3] rounded-xl shimmer bg-card" />
                  ))}
                </div>
              }>
                <MovieGrid filters={filters} />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
