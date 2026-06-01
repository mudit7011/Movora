import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import HideScrollbar from '@/components/HideScrollbar'
import { PLATFORMS } from '@/lib/platforms'

export default function PlatformsPage() {
  return (
    <>
      <HideScrollbar />
      <Sidebar />
      <div className="min-h-screen pb-24 lg:pb-8 lg:pl-24 px-4 sm:px-6 lg:px-8 pt-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Streaming Platforms</h1>
          <p className="text-sm text-muted-foreground mt-1">Browse movies & shows by where they stream</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {PLATFORMS.map(p => (
            <Link
              key={p.slug}
              href={`/platforms/${p.slug}`}
              className="group flex flex-col items-center gap-3"
            >
              <div
                className="w-full aspect-square rounded-2xl overflow-hidden ring-2 ring-transparent group-hover:ring-primary/40 group-active:scale-95 transition-all duration-200 shadow-lg"
                style={{ background: p.bg }}
              >
                <img
                  src={`/platforms/${p.slug}.svg`}
                  alt={p.name}
                  className="w-full h-full object-contain p-4"
                  style={{ filter: p.logoFilter }}
                  loading="lazy"
                />
              </div>
              <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors text-center">
                {p.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
