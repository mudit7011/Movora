import Sidebar from '@/components/Sidebar'

// Instant placeholder shown via loading.tsx while a browse page's data loads.
// Keeps the sidebar/nav visible so navigation feels immediate despite backend latency.
export default function BrowseSkeleton() {
  return (
    <>
      <Sidebar />
      <div className="min-h-screen pb-24 lg:pb-8 lg:pl-24">
        {/* Filter bar placeholder */}
        <div className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-white/[0.06] pt-[env(safe-area-inset-top)]">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex gap-2 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-7 w-20 rounded-full bg-white/[0.06] animate-pulse flex-shrink-0" />
            ))}
          </div>
        </div>

        {/* Poster grid placeholder */}
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 lg:gap-5">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-white/[0.06] animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
