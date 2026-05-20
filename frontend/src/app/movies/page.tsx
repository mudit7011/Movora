import { api } from '@/lib/api'
import Sidebar from '@/components/Sidebar'
import BrowseClient from '@/components/BrowseClient'
import { Suspense } from 'react'
import type { MovieFilters } from '@/types/movie'

interface Props {
  searchParams: Promise<MovieFilters>
}

export const metadata = { title: 'Browse Movies — Movora' }

export default async function MoviesPage({ searchParams }: Props) {
  const filters = await searchParams
  const data = await api.getMovies({ ...filters, limit: '20', page: '1' }).catch(
    () => ({ movies: [], total: 0, page: 1, pages: 1 })
  )

  const filterKey = [
    filters.genre ?? '',
    filters.year ?? '',
    filters.language ?? '',
    filters.sort ?? 'recent',
  ].join('|')

  return (
    <>
      <Sidebar />
      <div className="min-h-screen pb-24 lg:pb-8 lg:pl-24">
        <Suspense>
          <BrowseClient
            key={filterKey}
            initialMovies={data.movies}
            initialTotal={data.total}
            initialPages={data.pages}
          />
        </Suspense>
      </div>
    </>
  )
}
