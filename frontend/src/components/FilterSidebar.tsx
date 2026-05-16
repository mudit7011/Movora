'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { XMarkIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline'

const GENRES = ['Action', 'Comedy', 'Drama', 'Horror', 'Romance', 'Sci-Fi', 'Thriller']
const LANGUAGES = ['English', 'Hindi', 'Hindi Dubbed', 'Telugu', 'Tamil']
const YEARS = Array.from({ length: 10 }, (_, i) => String(new Date().getFullYear() - i))

export default function FilterSidebar() {
  const router = useRouter()
  const params = useSearchParams()
  const [open, setOpen] = useState(false)

  const current = {
    genre: params.get('genre') ?? '',
    language: params.get('language') ?? '',
    year: params.get('year') ?? '',
  }

  const apply = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    router.push(`/movies?${next}`)
  }

  const reset = () => router.push('/movies')
  const hasFilters = current.genre || current.language || current.year

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden flex items-center gap-2 text-sm text-white/70 hover:text-white glass px-3 py-2 rounded-lg"
      >
        <AdjustmentsHorizontalIcon className="w-4 h-4" />
        Filters {hasFilters && <span className="text-crimson font-bold">•</span>}
      </button>

      <aside className="hidden lg:block w-52 flex-shrink-0">
        <FilterContent current={current} apply={apply} reset={reset} />
      </aside>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-40 lg:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 w-64 bg-base border-r border-white/10 p-6 lg:hidden"
            >
              <div className="flex justify-between items-center mb-6">
                <span className="font-semibold">Filters</span>
                <button onClick={() => setOpen(false)}>
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <FilterContent
                current={current}
                apply={(k, v) => { apply(k, v); setOpen(false) }}
                reset={() => { reset(); setOpen(false) }}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

function FilterContent({ current, apply, reset }: {
  current: { genre: string; language: string; year: string }
  apply: (key: string, value: string) => void
  reset: () => void
}) {
  return (
    <div className="space-y-6">
      <FilterGroup label="Genre" options={GENRES} active={current.genre} onSelect={v => apply('genre', v === current.genre ? '' : v)} />
      <FilterGroup label="Language" options={LANGUAGES} active={current.language} onSelect={v => apply('language', v === current.language ? '' : v)} />
      <FilterGroup label="Year" options={YEARS} active={current.year} onSelect={v => apply('year', v === current.year ? '' : v)} />
      {(current.genre || current.language || current.year) && (
        <button onClick={reset} className="text-xs text-crimson hover:text-crimson-light">Clear all filters</button>
      )}
    </div>
  )
}

function FilterGroup({ label, options, active, onSelect }: {
  label: string; options: string[]; active: string; onSelect: (v: string) => void
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              active === opt
                ? 'bg-crimson border-crimson text-white'
                : 'border-white/15 text-white/60 hover:border-white/40 hover:text-white'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}
