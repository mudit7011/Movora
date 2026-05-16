'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

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
      <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
      <input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Search for a movie…"
        className="w-full bg-white/5 border border-white/10 focus:border-crimson text-white placeholder-muted rounded-xl pl-11 pr-4 py-4 text-lg outline-none transition-colors"
      />
    </div>
  )
}
