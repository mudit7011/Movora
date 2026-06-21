'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const NAV_ITEMS = [
  { label: 'Home',      href: '/' },
  { label: 'Movies',    href: '/movies' },
  { label: 'TV Shows',  href: '/shows' },
  { label: 'Watchlist', href: '/watchlist' },
  { label: 'History',   href: '/history' },
  { label: 'Search',    href: '/search' },
]

export default function TvNavbar() {
  const pathname = usePathname()
  const [focusedIdx, setFocusedIdx] = useState(-1)

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center gap-10 px-16 h-20
                 bg-gradient-to-b from-background/95 to-transparent backdrop-blur-md
                 border-b border-white/[0.05]"
    >
      {/* Logo */}
      <span className="text-2xl font-bold tracking-tight flex-shrink-0 mr-4">
        <span className="text-foreground">Mo</span>
        <span className="text-primary">vora</span>
      </span>

      {/* Nav Links */}
      <div className="flex items-center gap-2">
        {NAV_ITEMS.map((item, idx) => {
          const isActive  = pathname === item.href
          const isFocused = focusedIdx === idx

          return (
            <Link
              key={item.href}
              href={item.href}
              data-focusable
              tabIndex={0}
              onFocus={() => setFocusedIdx(idx)}
              onBlur={() => setFocusedIdx(-1)}
              className="relative px-5 py-2.5 rounded-xl text-base font-medium outline-none select-none"
              style={{
                color: isActive || isFocused ? 'rgb(6,214,224)' : 'rgba(255,255,255,0.6)',
                boxShadow: isFocused ? '0 0 0 2px rgb(6,214,224), 0 0 16px rgba(6,214,224,0.3)' : 'none',
                background: isFocused ? 'rgba(6,214,224,0.08)' : isActive ? 'rgba(6,214,224,0.06)' : 'transparent',
                borderRadius: '10px',
              }}
            >
              {(isActive || isFocused) && (
                <span
                  className="absolute inset-0 rounded-xl border border-primary/30"
                  style={{ pointerEvents: 'none' }}
                />
              )}
              <span className="relative z-10">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
