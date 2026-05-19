import { api } from '@/lib/api'
import MovieCard from '@/components/MovieCard'
import SearchInput from '@/components/SearchInput'
import Sidebar from '@/components/Sidebar'
import { Suspense } from 'react'

export const metadata = { title: 'Search — Movora' }

async function SearchResults({ q }: { q: string }) {
  if (!q.trim()) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </div>
        <p className="text-lg text-muted-foreground">Start typing to search for movies</p>
      </div>
    )
  }

  const movies = await api.search(q).catch(() => [])

  if (movies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 15s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
          </svg>
        </div>
        <p className="text-lg text-foreground">No results for <span className="text-primary">&ldquo;{q}&rdquo;</span></p>
        <p className="text-muted-foreground text-sm mt-2">Try a different title or check the spelling</p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-6">{movies.length} result{movies.length !== 1 ? 's' : ''} for &ldquo;{q}&rdquo;</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
        {movies.map(movie => (
          <MovieCard key={movie._id} movie={movie} />
        ))}
      </div>
    </div>
  )
}

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function SearchPage({ searchParams }: Props) {
  const { q = '' } = await searchParams
  return (
    <>
      <Sidebar />
      <div className="min-h-screen pt-8 pb-24 lg:pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:pl-28 lg:pr-8 py-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-8">Search</h1>
          <Suspense>
            <SearchInput />
          </Suspense>
          <div className="mt-10">
            <Suspense fallback={
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            }>
              <SearchResults q={q} />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  )
}
