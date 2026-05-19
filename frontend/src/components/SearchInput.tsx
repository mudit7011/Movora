'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'

const SearchIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
)

export default function SearchInput() {
  const router = useRouter()
  const params = useSearchParams()
  const [value, setValue] = useState(params.get('q') ?? '')

  useEffect(() => {
    if (!value.trim()) return
    const timer = setTimeout(() => {
      router.push(`/search?q=${encodeURIComponent(value.trim())}`)
    }, 400)
    return () => clearTimeout(timer)
  }, [value, router])

  return (
    <div className="relative max-w-2xl mx-auto">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
        <SearchIcon />
      </div>
      <input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Search for a movie..."
        className="w-full bg-card border border-white/10 focus:border-primary text-foreground placeholder-muted-foreground rounded-xl pl-12 pr-4 py-4 text-lg outline-none transition-all focus:ring-2 focus:ring-primary/20"
      />
    </div>
  )
}
