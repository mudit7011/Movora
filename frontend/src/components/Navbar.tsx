'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
      setSearchOpen(false)
      setQuery('')
    }
  }

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`text-sm font-medium transition-colors ${
        pathname === href ? 'text-crimson' : 'text-white/70 hover:text-white'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass border-b border-white/5' : 'bg-gradient-to-b from-black/60 to-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        <Link href="/" className="font-display text-2xl tracking-widest text-white">
          <span className="text-crimson">M</span>OVORA
        </Link>

        <div className="hidden sm:flex items-center gap-6">
          {navLink('/', 'Home')}
          {navLink('/movies', 'Movies')}
        </div>

        <div className="flex items-center gap-3">
          {searchOpen ? (
            <form onSubmit={handleSearch} className="flex items-center">
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onBlur={() => !query && setSearchOpen(false)}
                placeholder="Search movies…"
                className="bg-white/10 text-white placeholder-white/40 text-sm px-3 py-1.5 rounded-lg outline-none border border-white/10 w-48 focus:border-crimson transition-colors"
              />
            </form>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Open search"
              className="p-2 text-white/70 hover:text-white transition-colors"
            >
              <MagnifyingGlassIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}
