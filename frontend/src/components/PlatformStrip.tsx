'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { PLATFORMS } from '@/lib/platforms'
import { api } from '@/lib/api'
import { useTV } from '@/components/TvProvider'

const TMDB_LOGO = 'https://image.tmdb.org/t/p/w92'

export default function PlatformStrip() {
  const isTV = useTV()
  const [logoMap, setLogoMap] = useState<Record<number, string>>({})

  useEffect(() => {
    api.getProviders()
      .then(data => {
        const map: Record<number, string> = {}
        data.forEach(p => { map[p.provider_id] = p.logo_path })
        setLogoMap(map)
      })
      .catch(() => {})
  }, [])

  return (
    <section className="pt-6 pb-2">
      <div className={`mb-3 px-4 sm:px-6 ${isTV ? 'lg:px-16' : 'lg:pl-24 lg:pr-8'}`}>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Stream by Platform</h2>
      </div>
      <div
        className={`flex gap-4 overflow-x-auto pb-2
          [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
          ${isTV ? 'px-16 gap-6' : 'px-4 sm:px-6 lg:pl-24 lg:pr-8'}`}
      >
        {PLATFORMS.map(p => {
          const logoPath = logoMap[p.providerId]
          return (
            <Link
              key={p.slug}
              href={`/platforms/${p.slug}`}
              className="flex-shrink-0 flex flex-col items-center gap-2 group"
            >
              <div
                className="w-16 h-16 rounded-2xl overflow-hidden ring-2 ring-transparent group-hover:ring-primary/40 group-active:scale-95 transition-all duration-200 shadow-lg"
                style={{ background: p.bg }}
              >
                {logoPath ? (
                  <img
                    src={`${TMDB_LOGO}${logoPath}`}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-white text-[10px] font-bold text-center px-1 leading-tight">
                      {p.name}
                    </span>
                  </div>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors text-center leading-tight max-w-[72px]">
                {p.name}
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
