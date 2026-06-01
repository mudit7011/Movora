'use client'

import Link from 'next/link'
import { PLATFORMS } from '@/lib/platforms'
import { useTV } from '@/components/TvProvider'

export default function PlatformStrip() {
  const isTV = useTV()

  return (
    <section className="pt-6 pb-2 lg:hidden">
      <div className={`mb-3 px-4 sm:px-6 ${isTV ? 'lg:px-16' : ''}`}>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Stream by Platform</h2>
      </div>
      <div
        className={`flex gap-4 overflow-x-auto pb-2
          [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
          ${isTV ? 'px-16 gap-6' : 'px-4 sm:px-6'}`}
      >
        {PLATFORMS.map(p => (
          <Link
            key={p.slug}
            href={`/platforms/${p.slug}`}
            className="flex-shrink-0 flex flex-col items-center gap-2 group"
          >
            <div
              className="w-16 h-16 rounded-2xl overflow-hidden ring-2 ring-transparent group-hover:ring-primary/40 group-active:scale-95 transition-all duration-200 shadow-lg"
              style={{ background: p.bg }}
            >
              <img
                src={`/platforms/${p.slug}.${p.logoExt ?? 'svg'}`}
                alt={p.name}
                className="w-full h-full object-contain p-2"
                style={{ filter: p.logoFilter }}
                loading="lazy"
              />
            </div>
            <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors text-center leading-tight max-w-[72px]">
              {p.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
