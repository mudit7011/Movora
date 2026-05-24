'use client'
import { createContext, useContext, useEffect } from 'react'
import { useTvMode } from '@/hooks/useTvMode'

const TvContext = createContext(false)
export const useTV = () => useContext(TvContext)

// Find all elements marked as TV-focusable
function getFocusables(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-focusable]')) as HTMLElement[]
}

// Spatial navigation: find the nearest focusable element in a direction
function getNearest(
  current: HTMLElement,
  dir: 'up' | 'down' | 'left' | 'right'
): HTMLElement | null {
  const all = getFocusables()
  const cr  = current.getBoundingClientRect()
  const cx  = cr.left + cr.width  / 2
  const cy  = cr.top  + cr.height / 2

  let best: HTMLElement | null = null
  let bestScore = Infinity

  for (const el of all) {
    if (el === current) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue

    const ex = r.left + r.width  / 2
    const ey = r.top  + r.height / 2
    const dx = ex - cx
    const dy = ey - cy

    const inDir =
      dir === 'right' ? dx >  20 :
      dir === 'left'  ? dx < -20 :
      dir === 'down'  ? dy >  20 :
                        dy < -20

    if (!inDir) continue

    // Score: primary axis distance + side-axis penalty
    const primary   = dir === 'left' || dir === 'right' ? Math.abs(dx) : Math.abs(dy)
    const secondary = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx)
    const score     = primary + secondary * 2.5

    if (score < bestScore) { bestScore = score; best = el }
  }

  return best
}

export function TvProvider({ children }: { children: React.ReactNode }) {
  const isTV = useTvMode()

  useEffect(() => {
    if (!isTV) return

    // Mark the document so CSS TV rules apply
    document.documentElement.setAttribute('data-tv', '1')

    // Auto-focus first card on mount
    setTimeout(() => {
      const first = getFocusables()[0]
      if (first) first.focus()
    }, 500)

    const handleKey = (e: KeyboardEvent) => {
      const dirMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      }
      const dir = dirMap[e.key]

      // Enter = click focused element
      if (e.key === 'Enter') {
        const focused = document.activeElement as HTMLElement
        focused?.click()
        return
      }

      if (!dir) return
      e.preventDefault()

      const focused = document.activeElement as HTMLElement

      // If nothing focusable is focused, pick the first visible one
      if (!focused?.hasAttribute('data-focusable')) {
        const first = getFocusables().find(el => {
          const r = el.getBoundingClientRect()
          return r.top >= 0 && r.top < window.innerHeight
        })
        if (first) { first.focus(); first.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }) }
        return
      }

      const next = getNearest(focused, dir)
      if (next) {
        next.focus()
        next.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isTV])

  return <TvContext.Provider value={isTV}>{children}</TvContext.Provider>
}
