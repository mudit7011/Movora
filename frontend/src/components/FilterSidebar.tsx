'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'

const XIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)

const FilterIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
  </svg>
)

const GENRES = ['Action', 'Comedy', 'Drama', 'Horror', 'Romance', 'Sci-Fi', 'Thriller']
const LANGUAGES = ['English', 'Hindi']
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
        className="lg:hidden flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground glass px-4 py-2.5 rounded-xl"
      >
        <FilterIcon />
        Filters {hasFilters && <span className="text-primary font-bold">({Object.values(current).filter(Boolean).length})</span>}
      </button>

      <aside className="hidden lg:block w-56 flex-shrink-0">
        <FilterContent current={current} apply={apply} reset={reset} />
      </aside>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-background border-r border-white/10 p-6 lg:hidden"
            >
              <div className="flex justify-between items-center mb-6">
                <span className="font-semibold text-foreground">Filters</span>
                <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-white/5">
                  <XIcon />
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
    <div className="space-y-8">
      <FilterGroup label="Genre" options={GENRES} active={current.genre} onSelect={v => apply('genre', v === current.genre ? '' : v)} />
      <FilterGroup label="Language" options={LANGUAGES} active={current.language} onSelect={v => apply('language', v === current.language ? '' : v)} />
      <FilterGroup label="Year" options={YEARS} active={current.year} onSelect={v => apply('year', v === current.year ? '' : v)} />
      {(current.genre || current.language || current.year) && (
        <button onClick={reset} className="text-sm text-primary hover:text-primary/80 font-medium transition-colors">
          Clear all filters
        </button>
      )}
    </div>
  )
}

function FilterGroup({ label, options, active, onSelect }: {
  label: string; options: string[]; active: string; onSelect: (v: string) => void
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            className={`text-sm px-3 py-1.5 rounded-lg border transition-all ${
              active === opt
                ? 'bg-primary/20 border-primary/50 text-primary'
                : 'border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}
