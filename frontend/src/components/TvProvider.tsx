'use client'
import { createContext, useContext, useEffect, useRef } from 'react'
import { useTvMode } from '@/hooks/useTvMode'

const TvContext = createContext(false)
export const useTV = () => useContext(TvContext)

function getFocusables(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-focusable]')).filter(el => {
    const r = (el as HTMLElement).getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }) as HTMLElement[]
}

function getNearest(current: HTMLElement, dir: 'up' | 'down' | 'left' | 'right'): HTMLElement | null {
  const all = getFocusables()
  const cr = current.getBoundingClientRect()
  const cx = cr.left + cr.width / 2
  const cy = cr.top + cr.height / 2

  let best: HTMLElement | null = null
  let bestScore = Infinity

  for (const el of all) {
    if (el === current) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue

    const ex = r.left + r.width / 2
    const ey = r.top + r.height / 2
    const dx = ex - cx
    const dy = ey - cy

    const inDir =
      dir === 'right' ? dx > 20 :
      dir === 'left'  ? dx < -20 :
      dir === 'down'  ? dy > 20 :
                        dy < -20

    if (!inDir) continue

    const primary   = dir === 'left' || dir === 'right' ? Math.abs(dx) : Math.abs(dy)
    const secondary = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx)
    const score     = primary + secondary * 2.5

    if (score < bestScore) { bestScore = score; best = el }
  }

  return best
}

// Scroll element into view — compatible with WebOS, Tizen, Android TV, older Chromium.
// Does NOT use scrollIntoView() because it's unreliable on old TV browsers.
function scrollToEl(el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  const vH = window.innerHeight

  // Vertical: bring into view with some header clearance
  if (rect.top < 100 || rect.bottom > vH - 60) {
    const targetY = window.pageYOffset + rect.top - vH / 2 + rect.height / 2
    try {
      window.scrollTo({ top: Math.max(0, targetY), behavior: 'auto' })
    } catch {
      document.documentElement.scrollTop = Math.max(0, targetY)
    }
  }

  // Horizontal: scroll the nearest overflow-x parent (carousels)
  let parent = el.parentElement
  while (parent && parent !== document.body) {
    const style = window.getComputedStyle(parent)
    if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
      const pRect = parent.getBoundingClientRect()
      if (rect.left < pRect.left + 20 || rect.right > pRect.right - 20) {
        const target = parent.scrollLeft + rect.left - pRect.left - pRect.width / 2 + rect.width / 2
        try {
          parent.scrollTo({ left: Math.max(0, target), behavior: 'auto' })
        } catch {
          parent.scrollLeft = Math.max(0, target)
        }
      }
      break
    }
    parent = parent.parentElement
  }
}

// Key codes for all major Smart TV platforms
// ArrowKey strings for modern browsers; keyCode numbers for old TV browser engines
const TV_KEYCODES: Record<number, 'up' | 'down' | 'left' | 'right' | 'enter' | 'back'> = {
  38: 'up',    40: 'down',  37: 'left',  39: 'right',
  13: 'enter',
  461:   'back',   // WebOS back
  10009: 'back',   // Tizen back
  65385: 'back',   // Tizen back (alt)
  10182: 'back',   // Tizen exit
  27:    'back',   // Android TV / Fire TV / Escape
}

const ARROW_MAP: Partial<Record<string, 'up' | 'down' | 'left' | 'right'>> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
}

type TVAction = 'up' | 'down' | 'left' | 'right' | 'enter' | 'back'

function getAction(e: KeyboardEvent): TVAction | undefined {
  const named = ARROW_MAP[e.key]
  if (named) return named
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  return TV_KEYCODES[e.keyCode] ?? TV_KEYCODES[e.which]
}

export function TvProvider({ children }: { children: React.ReactNode }) {
  const isTV = useTvMode()
  const lastKeyAt = useRef(0)

  useEffect(() => {
    if (!isTV) return

    document.documentElement.setAttribute('data-tv', '1')

    // Auto-focus first visible card after page paints
    const timer = setTimeout(() => {
      const first = getFocusables().find(el => {
        const r = el.getBoundingClientRect()
        return r.top >= 60 && r.bottom <= window.innerHeight
      })
      if (first) {
        try { first.focus({ preventScroll: true }) } catch { first.focus() }
        scrollToEl(first)
      }
    }, 600)

    const handleKey = (e: KeyboardEvent) => {
      // Throttle key-repeat: TV remotes fire at ~8 Hz; 120ms prevents skipping rows
      const now = Date.now()
      if (e.repeat && now - lastKeyAt.current < 120) return
      lastKeyAt.current = now

      const action = getAction(e)

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      if (e.key === 'Enter' || e.keyCode === 13) {
        ;(document.activeElement as HTMLElement)?.click()
        return
      }

      if (action === 'back') {
        e.preventDefault()
        window.history.back()
        return
      }

      if (!action) return
      e.preventDefault()

      const focused = document.activeElement as HTMLElement | null

      if (!focused?.hasAttribute('data-focusable')) {
        // Nothing focused — pick the first card visible in viewport
        const first = getFocusables().find(el => {
          const r = el.getBoundingClientRect()
          return r.top >= 60 && r.top < window.innerHeight
        })
        if (first) {
          try { first.focus({ preventScroll: true }) } catch { first.focus() }
          scrollToEl(first)
        }
        return
      }

      if (action === 'enter') return
      const next = getNearest(focused, action)
      if (next) {
        try { next.focus({ preventScroll: true }) } catch { next.focus() }
        scrollToEl(next)
      }
    }

    window.addEventListener('keydown', handleKey, { capture: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', handleKey, { capture: true })
    }
  }, [isTV])

  return <TvContext.Provider value={isTV}>{children}</TvContext.Provider>
}
