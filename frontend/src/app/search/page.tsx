import { api } from '@/lib/api'
import MovieCard from '@/components/MovieCard'
import SearchInput from '@/components/SearchInput'
import Sidebar from '@/components/Sidebar'
import { Suspense } from 'react'
import { Swords, Laugh, Theater, Ghost, Rocket, Heart } from 'lucide-react'

export const metadata = { title: 'Search — Movora' }

async function SearchResults({ q }: { q: string }) {
  if (!q.trim()) {
    return null
  }

  const [movies, shows] = await Promise.all([
    api.search(q).catch(() => []),
    api.searchShows(q).catch(() => []),
  ])
  // Interleave by index so title-matching shows surface alongside title-matching movies
  const results = []
  const len = Math.max(movies.length, shows.length)
  for (let i = 0; i < len; i++) {
    if (i < movies.length) results.push(movies[i])
    if (i < shows.length) results.push(shows[i])
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
          <div className="relative w-24 h-24 rounded-full bg-card border border-white/10 flex items-center justify-center">
            <svg className="w-12 h-12 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 15s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
            </svg>
          </div>
        </div>
        <p className="text-xl font-semibold text-foreground mb-2">No results for <span className="text-primary">&ldquo;{q}&rdquo;</span></p>
        <p className="text-muted-foreground text-sm max-w-md text-center">
          We couldn&apos;t find any movies matching your search. Try different keywords or browse our categories.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Found</p>
          <p className="text-2xl font-bold text-foreground">
            {results.length} <span className="text-primary">result{results.length !== 1 ? 's' : ''}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-white/20 transition-all">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h10M4 18h4" />
              </svg>
              Filters
            </span>
          </button>
          <select className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-foreground outline-none cursor-pointer hover:border-white/20 transition-all">
            <option value="relevance">Relevance</option>
            <option value="rating">Top Rated</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
        {results.map((movie, index) => (
          <div
            key={movie._id}
            className="animate-fade-in-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <MovieCard movie={movie} />
          </div>
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
  const hasQuery = q.trim().length > 0

  return (
    <>
      <Sidebar />
      <div className="min-h-screen lg:pl-24">
        {/* Hero Search Section */}
        <div className={`relative transition-all duration-500 ${hasQuery ? 'pt-8 pb-8' : 'pt-32 pb-20'}`}>
          {/* Animated Background Gradient */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-primary/5 to-transparent rounded-full" />
          </div>
          
          <div className="relative max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Title Section - Only show when no query */}
            {!hasQuery && (
              <div className="text-center mb-12">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-4">
                  Discover Your Next
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary via-cyan-400 to-primary">
                    Favorite Movie
                  </span>
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Search through thousands of movies. Find hidden gems, classics, and the latest releases.
                </p>
              </div>
            )}

            {/* Search Input */}
            <Suspense>
              <SearchInput />
            </Suspense>
          </div>
        </div>

        {/* Results Section */}
        <div className="relative max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 lg:pb-8">
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center py-20">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                <div className="relative w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-muted-foreground mt-4">Searching...</p>
            </div>
          }>
            <SearchResults q={q} />
          </Suspense>

          {/* Quick Categories - Show when no query */}
          {!hasQuery && (
            <div className="mt-16">
              <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-3">
                <span className="w-1 h-6 bg-primary rounded-full" />
                Popular Categories
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {[
                  { name: 'Action',  gradient: 'from-red-500/20 to-orange-500/20',  Icon: Swords  },
                  { name: 'Comedy',  gradient: 'from-yellow-500/20 to-amber-500/20', Icon: Laugh   },
                  { name: 'Drama',   gradient: 'from-purple-500/20 to-pink-500/20',  Icon: Theater },
                  { name: 'Horror',  gradient: 'from-gray-500/20 to-slate-500/20',   Icon: Ghost   },
                  { name: 'Sci-Fi',  gradient: 'from-blue-500/20 to-cyan-500/20',    Icon: Rocket  },
                  { name: 'Romance', gradient: 'from-pink-500/20 to-rose-500/20',    Icon: Heart   },
                ].map(({ name, gradient, Icon }) => (
                  <a
                    key={name}
                    href={`/search?q=${name}`}
                    className={`group relative p-6 rounded-2xl bg-gradient-to-br ${gradient} border border-white/10 hover:border-primary/50 transition-all duration-300 hover:scale-105`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                    <div className="relative text-center">
                      <Icon className="w-8 h-8 mx-auto mb-2 group-hover:scale-110 transition-transform text-white/80" />
                      <span className="text-foreground font-medium">{name}</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
