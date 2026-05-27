'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'rating',    label: 'Top Rated' },
  { value: 'newest',    label: 'Newest'    },
  { value: 'oldest',    label: 'Oldest'    },
]

const TYPE_OPTIONS = [
  { value: 'all',   label: 'All'    },
  { value: 'movie', label: 'Movies' },
  { value: 'show',  label: 'Shows'  },
]

export default function SearchFilters({ total }: { total: number }) {
  const router      = useRouter()
  const params      = useSearchParams()
  const sort        = params.get('sort') || 'relevance'
  const type        = params.get('type') || 'all'

  const set = (key: string, value: string) => {
    const p = new URLSearchParams(params.toString())
    p.set(key, value)
    router.push(`/search?${p.toString()}`, { scroll: false })
  }

  return (
    <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
      <div>
        <p className="text-sm text-muted-foreground mb-1">Found</p>
        <p className="text-2xl font-bold text-foreground">
          {total} <span className="text-primary">result{total !== 1 ? 's' : ''}</span>
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Type filter pills */}
        <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-xl p-1">
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => set('type', opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                type === opt.value
                  ? 'bg-primary text-background shadow-sm shadow-primary/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Sort dropdown */}
        <select
          value={sort}
          onChange={e => set('sort', e.target.value)}
          className="px-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-foreground outline-none cursor-pointer hover:border-white/20 transition-all"
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
