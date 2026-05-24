'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'

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

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
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
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              data-focusable
              tabIndex={0}
              className={`relative px-5 py-2.5 rounded-xl text-base font-medium transition-colors duration-200 outline-none
                ${isActive
                  ? 'text-primary'
                  : 'text-white/60 hover:text-white focus:text-white'
                }`}
            >
              {isActive && (
                <motion.div
                  layoutId="tv-nav-active"
                  className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/30"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </motion.nav>
  )
}
