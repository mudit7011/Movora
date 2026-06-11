export const revalidate = 300

import { api } from '@/lib/api'
import Sidebar from '@/components/Sidebar'
import MovieCard from '@/components/MovieCard'

export const metadata = { title: 'New & Popular — Movora' }

export default async function NewPopularPage() {
  const items = await api.getNew().catch(() => [])

  return (
    <>
      <Sidebar />
      <div className="min-h-screen pb-24 lg:pb-8 lg:pl-24">
        {/* Header */}
        <div className="px-4 sm:px-6 lg:px-8 pt-[calc(2.5rem_+_env(safe-area-inset-top))] pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
              </svg>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">New & Popular</h1>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Latest movies and TV shows — Hindi & English</p>
        </div>

        {/* Grid */}
        <div className="px-4 sm:px-6 lg:px-8">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <p className="text-muted-foreground">Nothing here yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 lg:gap-5">
              {items.map((item) => (
                <div key={item._id} className="relative">
                  {/* NEW badge for items from current year */}
                  {item.releaseYear >= new Date().getFullYear() && (
                    <div className="absolute top-2 left-2 z-20">
                      <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-primary text-background rounded-sm">
                        New
                      </span>
                    </div>
                  )}
                  <MovieCard movie={item} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
