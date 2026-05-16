# Frontend Public Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public-facing Movora frontend — Homepage, Browse, Search, and Movie Detail pages — using Next.js 14 App Router with the Crimson Gold design system (deep black `#0A0A0F` + crimson `#C41E3A` + gold `#F5A623`) and Framer Motion animations.

**Architecture:** Server Components fetch data from the backend REST API at build/request time. Client Components (`'use client'`) handle animations (Framer Motion), scroll behavior, and interactivity. The Watch page and Admin panel are Plan 4.

**Tech Stack:** Next.js 14 (App Router), TypeScript, TailwindCSS, Framer Motion, next/font (Inter + Bebas Neue), next/image, Jest + React Testing Library

---

## File Map

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout — fonts, Navbar, global bg
│   │   ├── globals.css             # Tailwind base + custom grain overlay
│   │   ├── page.tsx                # Homepage — Hero + carousels
│   │   ├── movies/
│   │   │   └── page.tsx            # Browse all movies + filter sidebar
│   │   ├── search/
│   │   │   └── page.tsx            # Search results page
│   │   └── movie/
│   │       └── [slug]/
│   │           └── page.tsx        # Movie detail page
│   ├── components/
│   │   ├── Navbar.tsx              # 'use client' — sticky, scroll-aware
│   │   ├── Hero.tsx                # 'use client' — Framer Motion entrance
│   │   ├── MovieCard.tsx           # 'use client' — hover glow + scale
│   │   ├── Carousel.tsx            # 'use client' — drag scroll, arrows
│   │   ├── RatingBadge.tsx         # server-safe — gold star + score
│   │   ├── GenreChip.tsx           # server-safe — crimson pill chip
│   │   ├── FilterSidebar.tsx       # 'use client' — slide-in filter drawer
│   │   └── SearchInput.tsx         # 'use client' — debounced search bar
│   ├── lib/
│   │   └── api.ts                  # fetch wrapper targeting backend REST API
│   └── types/
│       └── movie.ts                # TypeScript interfaces (Movie, Source, etc.)
├── public/
│   └── grain.png                   # Film grain overlay texture (512×512 PNG)
├── __tests__/
│   ├── api.test.ts
│   ├── MovieCard.test.tsx
│   └── Navbar.test.tsx
├── jest.config.ts
├── jest.setup.ts
├── tailwind.config.ts
├── next.config.ts
├── .env.local.example
├── package.json
└── tsconfig.json
```

---

### Task 1: Next.js project setup + Tailwind Crimson Gold theme

**Files:**
- Create: `frontend/` via `create-next-app`
- Modify: `frontend/tailwind.config.ts`
- Modify: `frontend/next.config.ts`
- Create: `frontend/.env.local.example`
- Create: `frontend/jest.config.ts`
- Create: `frontend/jest.setup.ts`

- [ ] **Step 1: Scaffold the project**

Run from the `StreamingSite/` root:

```bash
npx create-next-app@14 frontend \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-git
```

- [ ] **Step 2: Install additional dependencies**

```bash
cd frontend
npm install framer-motion @heroicons/react
npm install -D jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest @types/jest
```

- [ ] **Step 3: Create `frontend/.env.local.example`**

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Copy to `.env.local` and fill in the value:

```bash
cp .env.local.example .env.local
```

- [ ] **Step 4: Replace `frontend/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        base: '#0A0A0F',
        crimson: {
          DEFAULT: '#C41E3A',
          dark: '#9B162C',
          light: '#E02040',
        },
        gold: {
          DEFAULT: '#F5A623',
          light: '#F7B843',
        },
        muted: '#A1A1AA',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        display: ['var(--font-bebas)', 'cursive'],
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(to right, rgba(10,10,15,0.95) 40%, rgba(10,10,15,0.4) 100%)',
        'card-fade': 'linear-gradient(to top, rgba(10,10,15,1) 0%, rgba(10,10,15,0) 60%)',
      },
      boxShadow: {
        'crimson-glow': '0 0 20px rgba(196,30,58,0.5)',
        'gold-glow': '0 0 15px rgba(245,166,35,0.4)',
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 5: Replace `frontend/next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
```

- [ ] **Step 6: Create `frontend/jest.config.ts`**

```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
}

export default createJestConfig(config)
```

- [ ] **Step 7: Create `frontend/jest.setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 8: Add test script to `frontend/package.json`**

Open `package.json` and add to the `"scripts"` block:

```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 9: Verify dev server starts**

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000` — default Next.js page should appear. Stop the server.

- [ ] **Step 10: Commit**

```bash
cd .. && git add frontend/ && git commit -m "feat(frontend): Next.js 14 project with Crimson Gold Tailwind theme"
```

---

### Task 2: TypeScript types + API client

**Files:**
- Create: `frontend/src/types/movie.ts`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/__tests__/api.test.ts`

- [ ] **Step 1: Write failing test — `frontend/__tests__/api.test.ts`**

```typescript
import { api } from '@/lib/api'

const MOCK_MOVIES = [
  { _id: '1', title: 'Pushpa', slug: 'pushpa-2021', rating: 7.6, posterUrl: '', genres: [], language: [], releaseYear: 2021, sources: [] },
]

global.fetch = jest.fn()

afterEach(() => jest.clearAllMocks())

test('getTrending calls /api/movies/trending', async () => {
  ;(fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => MOCK_MOVIES,
  })
  const result = await api.getTrending()
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/movies/trending'),
    expect.any(Object)
  )
  expect(result).toEqual(MOCK_MOVIES)
})

test('getMovies passes query params', async () => {
  ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ movies: [], total: 0, page: 1, pages: 1 }) })
  await api.getMovies({ genre: 'Action', page: '2' })
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('genre=Action'),
    expect.any(Object)
  )
})

test('throws when response is not ok', async () => {
  ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 })
  await expect(api.getTrending()).rejects.toThrow('API error: 500')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx jest __tests__/api.test.ts
```

Expected: `Cannot find module '@/lib/api'`

- [ ] **Step 3: Create `frontend/src/types/movie.ts`**

```typescript
export interface Source {
  serverName: string
  url: string
  type: 'iframe' | 'direct'
  quality: string
  isWorking: boolean
}

export interface CastMember {
  name: string
  character?: string
  photo?: string
}

export interface Movie {
  _id: string
  tmdbId: string
  title: string
  titleHindi?: string
  slug: string
  type: 'movie'
  language: string[]
  genres: string[]
  releaseYear: number
  rating: number
  runtime: number
  synopsis: string
  posterUrl: string
  backdropUrl: string
  trailerKey?: string
  cast: CastMember[]
  sources: Source[]
  scrapedFrom: string
  createdAt: string
  updatedAt: string
}

export interface PaginatedMovies {
  movies: Movie[]
  total: number
  page: number
  pages: number
}

export interface MovieFilters {
  genre?: string
  year?: string
  language?: string
  minRating?: string
  page?: string
}
```

- [ ] **Step 4: Create `frontend/src/lib/api.ts`**

```typescript
import type { Movie, PaginatedMovies, MovieFilters } from '@/types/movie'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    next: { revalidate: 300 },
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json() as Promise<T>
}

export const api = {
  getTrending: () => apiFetch<Movie[]>('/api/movies/trending'),
  getLatest: () => apiFetch<Movie[]>('/api/movies/latest'),
  getMovies: (filters: MovieFilters = {}) => {
    const params = new URLSearchParams(filters as Record<string, string>)
    return apiFetch<PaginatedMovies>(`/api/movies?${params}`)
  },
  search: (q: string) =>
    apiFetch<Movie[]>(`/api/movies/search?q=${encodeURIComponent(q)}`),
  getMovie: (slug: string) => apiFetch<Movie>(`/api/movies/${slug}`),
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd frontend && npx jest __tests__/api.test.ts
```

Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
cd .. && git add frontend/src/types/ frontend/src/lib/ frontend/__tests__/api.test.ts && git commit -m "feat(frontend): TypeScript types and API client with tests"
```

---

### Task 3: Global layout + globals.css + Navbar

**Files:**
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/app/layout.tsx`
- Create: `frontend/src/components/Navbar.tsx`
- Create: `frontend/__tests__/Navbar.test.tsx`

- [ ] **Step 1: Write failing test — `frontend/__tests__/Navbar.test.tsx`**

```typescript
import { render, screen } from '@testing-library/react'
import Navbar from '@/components/Navbar'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/',
}))

test('renders Movora logo', () => {
  render(<Navbar />)
  expect(screen.getByText('MOVORA')).toBeInTheDocument()
})

test('renders Movies nav link', () => {
  render(<Navbar />)
  expect(screen.getByRole('link', { name: /movies/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx jest __tests__/Navbar.test.tsx
```

Expected: `Cannot find module '@/components/Navbar'`

- [ ] **Step 3: Replace `frontend/src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #0A0A0F;
}

body {
  background-color: var(--background);
  color: #ffffff;
}

/* Film grain overlay — applied to Hero sections */
.grain::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url('/grain.png');
  background-repeat: repeat;
  opacity: 0.035;
  pointer-events: none;
  z-index: 10;
}

/* Glassmorphism card */
.glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* Hide scrollbar but keep scrolling */
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
```

- [ ] **Step 4: Replace `frontend/src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Inter, Bebas_Neue } from 'next/font/google'
import Navbar from '@/components/Navbar'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const bebas = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
})

export const metadata: Metadata = {
  title: 'Movora — Watch Movies Online',
  description: 'Stream the latest movies in HD — English, Hindi, and Hindi Dubbed.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${bebas.variable}`}>
      <body className="bg-base text-white font-sans antialiased">
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Create `frontend/src/components/Navbar.tsx`**

```tsx
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
        {/* Logo */}
        <Link href="/" className="font-display text-2xl tracking-widest text-white">
          <span className="text-crimson">M</span>OVORA
        </Link>

        {/* Nav links */}
        <div className="hidden sm:flex items-center gap-6">
          {navLink('/', 'Home')}
          {navLink('/movies', 'Movies')}
        </div>

        {/* Search */}
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
```

- [ ] **Step 6: Create a 512×512 grain texture placeholder**

```bash
cd frontend && node -e "
const fs = require('fs');
// 1x1 transparent PNG as placeholder — replace with real grain texture later
const buf = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
fs.writeFileSync('public/grain.png', buf);
console.log('grain.png created');
"
```

- [ ] **Step 7: Run test to verify Navbar passes**

```bash
cd frontend && npx jest __tests__/Navbar.test.tsx
```

Expected: 2 passed.

- [ ] **Step 8: Verify layout renders**

```bash
npm run dev
```

Open `http://localhost:3000` — should see dark background with "MOVORA" navbar. Stop server.

- [ ] **Step 9: Commit**

```bash
cd .. && git add frontend/ && git commit -m "feat(frontend): root layout, global CSS, and Navbar component"
```

---

### Task 4: MovieCard + RatingBadge + GenreChip

**Files:**
- Create: `frontend/src/components/RatingBadge.tsx`
- Create: `frontend/src/components/GenreChip.tsx`
- Create: `frontend/src/components/MovieCard.tsx`
- Create: `frontend/__tests__/MovieCard.test.tsx`

- [ ] **Step 1: Write failing test — `frontend/__tests__/MovieCard.test.tsx`**

```typescript
import { render, screen } from '@testing-library/react'
import MovieCard from '@/components/MovieCard'
import type { Movie } from '@/types/movie'

const MOCK_MOVIE: Movie = {
  _id: '1',
  tmdbId: 'tt123',
  title: 'Pushpa: The Rise',
  slug: 'pushpa-the-rise-2021',
  type: 'movie',
  language: ['Hindi'],
  genres: ['Action'],
  releaseYear: 2021,
  rating: 7.6,
  runtime: 179,
  synopsis: 'A labourer rises…',
  posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
  backdropUrl: '',
  cast: [],
  sources: [],
  scrapedFrom: 'streamvaults.ru',
  createdAt: '',
  updatedAt: '',
}

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}))

test('renders movie title', () => {
  render(<MovieCard movie={MOCK_MOVIE} />)
  expect(screen.getByText('Pushpa: The Rise')).toBeInTheDocument()
})

test('renders rating', () => {
  render(<MovieCard movie={MOCK_MOVIE} />)
  expect(screen.getByText('7.6')).toBeInTheDocument()
})

test('renders language tag', () => {
  render(<MovieCard movie={MOCK_MOVIE} />)
  expect(screen.getByText('Hindi')).toBeInTheDocument()
})

test('links to movie detail page', () => {
  render(<MovieCard movie={MOCK_MOVIE} />)
  expect(screen.getByRole('link')).toHaveAttribute('href', '/movie/pushpa-the-rise-2021')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx jest __tests__/MovieCard.test.tsx
```

Expected: `Cannot find module '@/components/MovieCard'`

- [ ] **Step 3: Create `frontend/src/components/RatingBadge.tsx`**

```tsx
interface Props { rating: number }

export default function RatingBadge({ rating }: Props) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold bg-black/60 px-2 py-0.5 rounded">
      <span>★</span>
      <span>{rating.toFixed(1)}</span>
    </span>
  )
}
```

- [ ] **Step 4: Create `frontend/src/components/GenreChip.tsx`**

```tsx
interface Props { genre: string }

export default function GenreChip({ genre }: Props) {
  return (
    <span className="text-xs font-medium text-white/70 bg-white/10 border border-white/10 px-2 py-0.5 rounded-full">
      {genre}
    </span>
  )
}
```

- [ ] **Step 5: Create `frontend/src/components/MovieCard.tsx`**

```tsx
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import type { Movie } from '@/types/movie'
import RatingBadge from './RatingBadge'

interface Props {
  movie: Movie
}

export default function MovieCard({ movie }: Props) {
  return (
    <motion.div
      whileHover={{ scale: 1.04 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="group relative flex-shrink-0 w-40 sm:w-44 cursor-pointer"
    >
      <Link href={`/movie/${movie.slug}`}>
        <div className="relative aspect-[2/3] rounded-lg overflow-hidden ring-1 ring-white/10 group-hover:ring-crimson group-hover:shadow-crimson-glow transition-all duration-300">
          {movie.posterUrl ? (
            <Image
              src={movie.posterUrl}
              alt={movie.title}
              fill
              sizes="(max-width: 640px) 160px, 176px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-white/5 flex items-center justify-center text-muted text-xs">
              No Poster
            </div>
          )}
          {/* Bottom fade overlay */}
          <div className="absolute inset-0 bg-card-fade opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          {/* Rating badge — top right */}
          <div className="absolute top-2 right-2">
            <RatingBadge rating={movie.rating} />
          </div>
        </div>

        {/* Title + language */}
        <div className="mt-2 px-0.5">
          <p className="text-sm font-medium text-white line-clamp-1">{movie.title}</p>
          <p className="text-xs text-muted mt-0.5">{movie.language[0] ?? ''}</p>
        </div>
      </Link>
    </motion.div>
  )
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd frontend && npx jest __tests__/MovieCard.test.tsx
```

Expected: 4 passed.

- [ ] **Step 7: Commit**

```bash
cd .. && git add frontend/src/components/ frontend/__tests__/MovieCard.test.tsx && git commit -m "feat(frontend): MovieCard, RatingBadge, GenreChip components"
```

---

### Task 5: Carousel component

**Files:**
- Create: `frontend/src/components/Carousel.tsx`

- [ ] **Step 1: Create `frontend/src/components/Carousel.tsx`**

```tsx
'use client'

import { useRef } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import type { Movie } from '@/types/movie'
import MovieCard from './MovieCard'

interface Props {
  title: string
  movies: Movie[]
}

export default function Carousel({ title, movies }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  const scroll = (dir: 'left' | 'right') => {
    if (!ref.current) return
    ref.current.scrollBy({ left: dir === 'left' ? -360 : 360, behavior: 'smooth' })
  }

  if (movies.length === 0) return null

  return (
    <section className="py-6">
      <div className="flex items-center justify-between mb-4 px-4 sm:px-6 lg:px-8">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => scroll('left')}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={ref}
        className="flex gap-4 overflow-x-auto no-scrollbar px-4 sm:px-6 lg:px-8 pb-2"
      >
        {movies.map(movie => (
          <MovieCard key={movie._id} movie={movie} />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify import works**

```bash
cd frontend && node -e "console.log('Carousel OK')"
```

- [ ] **Step 3: Commit**

```bash
cd .. && git add frontend/src/components/Carousel.tsx && git commit -m "feat(frontend): Carousel component with arrow scroll"
```

---

### Task 6: Hero component

**Files:**
- Create: `frontend/src/components/Hero.tsx`

- [ ] **Step 1: Create `frontend/src/components/Hero.tsx`**

```tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import type { Movie } from '@/types/movie'
import RatingBadge from './RatingBadge'
import GenreChip from './GenreChip'

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0 },
}

const stagger = {
  show: { transition: { staggerChildren: 0.12 } },
}

interface Props {
  movie: Movie
}

export default function Hero({ movie }: Props) {
  return (
    <section className="relative h-[90vh] w-full overflow-hidden grain">
      {/* Backdrop */}
      {movie.backdropUrl && (
        <Image
          src={movie.backdropUrl}
          alt={movie.title}
          fill
          priority
          sizes="100vw"
          className="object-cover object-top"
        />
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-hero-gradient" />
      <div className="absolute inset-0 bg-gradient-to-t from-base via-transparent to-transparent" />

      {/* Content */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative z-10 flex flex-col justify-end h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20"
      >
        <motion.div variants={fadeUp} className="flex flex-wrap gap-2 mb-4">
          {movie.genres.slice(0, 3).map(g => (
            <GenreChip key={g} genre={g} />
          ))}
          <RatingBadge rating={movie.rating} />
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="font-display text-5xl sm:text-7xl lg:text-8xl text-white tracking-wide leading-none mb-4 max-w-2xl"
        >
          {movie.title}
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="text-white/70 text-sm sm:text-base max-w-lg mb-8 line-clamp-3"
        >
          {movie.synopsis}
        </motion.p>

        <motion.div variants={fadeUp} className="flex flex-wrap gap-4">
          <Link
            href={`/watch/${movie.slug}`}
            className="inline-flex items-center gap-2 bg-crimson hover:bg-crimson-dark text-white font-semibold px-6 py-3 rounded-lg transition-colors shadow-crimson-glow"
          >
            <span>▶</span> Play Now
          </Link>
          <Link
            href={`/movie/${movie.slug}`}
            className="inline-flex items-center gap-2 glass text-white font-semibold px-6 py-3 rounded-lg hover:bg-white/10 transition-colors"
          >
            <span>ℹ</span> More Info
          </Link>
        </motion.div>
      </motion.div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd .. && git add frontend/src/components/Hero.tsx && git commit -m "feat(frontend): Hero component with Framer Motion stagger animation"
```

---

### Task 7: Homepage

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Replace `frontend/src/app/page.tsx`**

```tsx
import { api } from '@/lib/api'
import Hero from '@/components/Hero'
import Carousel from '@/components/Carousel'

export default async function HomePage() {
  const [trending, latest] = await Promise.all([
    api.getTrending().catch(() => []),
    api.getLatest().catch(() => []),
  ])

  const hero = trending[0] ?? latest[0]

  const hindi = latest.filter(m => m.language.includes('Hindi'))
  const dubbed = latest.filter(m => m.language.some(l => l.toLowerCase().includes('dubbed')))
  const english = latest.filter(m => m.language.includes('English'))

  return (
    <>
      {hero && <Hero movie={hero} />}

      <div className="max-w-7xl mx-auto">
        <Carousel title="Trending Now" movies={trending} />
        <Carousel title="Latest Releases" movies={latest} />
        {hindi.length > 0 && <Carousel title="Hindi Movies" movies={hindi} />}
        {dubbed.length > 0 && <Carousel title="Hindi Dubbed" movies={dubbed} />}
        {english.length > 0 && <Carousel title="English Movies" movies={english} />}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Start dev server and verify homepage**

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000`. With the backend running (`cd backend && npm run dev`), you should see:
- Dark hero section (may be empty if no movies in DB yet)
- Navbar with "MOVORA" logo
- Carousels (empty if no data) — no errors

If backend is not running, the `.catch(() => [])` fallbacks ensure blank carousels instead of crashes.

- [ ] **Step 3: Commit**

```bash
cd .. && git add frontend/src/app/page.tsx && git commit -m "feat(frontend): homepage with Hero and language-filtered carousels"
```

---

### Task 8: Browse page + FilterSidebar

**Files:**
- Create: `frontend/src/components/FilterSidebar.tsx`
- Create: `frontend/src/app/movies/page.tsx`

- [ ] **Step 1: Create `frontend/src/components/FilterSidebar.tsx`**

```tsx
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
      {/* Mobile trigger */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden flex items-center gap-2 text-sm text-white/70 hover:text-white glass px-3 py-2 rounded-lg"
      >
        <AdjustmentsHorizontalIcon className="w-4 h-4" />
        Filters {hasFilters && <span className="text-crimson font-bold">•</span>}
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-52 flex-shrink-0">
        <FilterContent current={current} apply={apply} reset={reset} />
      </aside>

      {/* Mobile drawer */}
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
              <FilterContent current={current} apply={(k, v) => { apply(k, v); setOpen(false) }} reset={() => { reset(); setOpen(false) }} />
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
```

- [ ] **Step 2: Create `frontend/src/app/movies/page.tsx`**

```tsx
import { api } from '@/lib/api'
import MovieCard from '@/components/MovieCard'
import FilterSidebar from '@/components/FilterSidebar'
import { Suspense } from 'react'
import type { MovieFilters } from '@/types/movie'

interface Props {
  searchParams: MovieFilters
}

export const metadata = { title: 'Browse Movies — Movora' }

async function MovieGrid({ filters }: { filters: MovieFilters }) {
  const data = await api.getMovies(filters).catch(() => ({ movies: [], total: 0, page: 1, pages: 1 }))

  if (data.movies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted">
        <span className="text-5xl mb-4">🎬</span>
        <p className="text-lg font-medium">No movies found</p>
        <p className="text-sm mt-1">Try adjusting your filters</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
      {data.movies.map(movie => (
        <MovieCard key={movie._id} movie={movie} />
      ))}
    </div>
  )
}

export default function MoviesPage({ searchParams }: Props) {
  return (
    <div className="min-h-screen pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Browse Movies</h1>
          <Suspense>
            <FilterSidebar />
          </Suspense>
        </div>

        <div className="flex gap-8">
          <Suspense>
            <FilterSidebar />
          </Suspense>
          <div className="flex-1 min-w-0">
            <Suspense fallback={<div className="text-muted text-sm">Loading…</div>}>
              <MovieGrid filters={searchParams} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify browse page in browser**

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000/movies` — should see:
- Filter sidebar on desktop
- Movie grid (empty if no data, "No movies found" state shown)
- No JS errors

- [ ] **Step 4: Commit**

```bash
cd .. && git add frontend/src/components/FilterSidebar.tsx frontend/src/app/movies/ && git commit -m "feat(frontend): browse page with animated filter sidebar"
```

---

### Task 9: Search page

**Files:**
- Create: `frontend/src/app/search/page.tsx`
- Create: `frontend/src/components/SearchInput.tsx`

- [ ] **Step 1: Create `frontend/src/components/SearchInput.tsx`**

```tsx
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
```

- [ ] **Step 2: Create `frontend/src/app/search/page.tsx`**

```tsx
import { api } from '@/lib/api'
import MovieCard from '@/components/MovieCard'
import SearchInput from '@/components/SearchInput'
import { Suspense } from 'react'

export const metadata = { title: 'Search — Movora' }

async function SearchResults({ q }: { q: string }) {
  if (!q.trim()) {
    return (
      <p className="text-center text-muted mt-16">Start typing to search for movies</p>
    )
  }

  const movies = await api.search(q).catch(() => [])

  if (movies.length === 0) {
    return (
      <div className="text-center mt-16">
        <p className="text-lg text-white">No results for <span className="text-crimson">"{q}"</span></p>
        <p className="text-muted text-sm mt-2">Try a different title or check the spelling</p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm text-muted mb-6">{movies.length} result{movies.length !== 1 ? 's' : ''} for "{q}"</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
        {movies.map(movie => (
          <MovieCard key={movie._id} movie={movie} />
        ))}
      </div>
    </div>
  )
}

interface Props {
  searchParams: { q?: string }
}

export default function SearchPage({ searchParams }: Props) {
  const q = searchParams.q ?? ''

  return (
    <div className="min-h-screen pt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense>
          <SearchInput />
        </Suspense>
        <div className="mt-10">
          <Suspense fallback={<p className="text-muted text-sm text-center mt-10">Searching…</p>}>
            <SearchResults q={q} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify search page in browser**

```bash
npm run dev
```

Open `http://localhost:3000/search` — input should auto-focus. Typing should update the URL after 400ms debounce.

- [ ] **Step 4: Commit**

```bash
cd .. && git add frontend/src/components/SearchInput.tsx frontend/src/app/search/ && git commit -m "feat(frontend): search page with debounced input"
```

---

### Task 10: Movie detail page

**Files:**
- Create: `frontend/src/app/movie/[slug]/page.tsx`

- [ ] **Step 1: Create `frontend/src/app/movie/[slug]/page.tsx`**

```tsx
import { api } from '@/lib/api'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import RatingBadge from '@/components/RatingBadge'
import GenreChip from '@/components/GenreChip'
import type { Metadata } from 'next'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const movie = await api.getMovie(params.slug).catch(() => null)
  if (!movie) return { title: 'Movie — Movora' }
  return {
    title: `${movie.title} — Movora`,
    description: movie.synopsis,
  }
}

export default async function MovieDetailPage({ params }: Props) {
  const movie = await api.getMovie(params.slug).catch(() => null)
  if (!movie) notFound()

  const workingSources = movie.sources.filter(s => s.isWorking)

  return (
    <div className="min-h-screen">
      {/* Backdrop hero */}
      <div className="relative h-[50vh] sm:h-[60vh] w-full">
        {movie.backdropUrl && (
          <Image
            src={movie.backdropUrl}
            alt={movie.title}
            fill
            priority
            sizes="100vw"
            className="object-cover object-top"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-base via-base/80 to-base/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-base to-transparent" />
      </div>

      {/* Content — overlaps hero */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-36 sm:-mt-48 pb-16">
        <div className="flex flex-col sm:flex-row gap-8">
          {/* Poster */}
          <div className="flex-shrink-0 w-44 sm:w-56">
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden ring-1 ring-white/10 shadow-2xl">
              {movie.posterUrl ? (
                <Image src={movie.posterUrl} alt={movie.title} fill sizes="224px" className="object-cover" />
              ) : (
                <div className="w-full h-full bg-white/5" />
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="flex-1 min-w-0 pt-2">
            <h1 className="font-display text-4xl sm:text-5xl text-white tracking-wide mb-3">
              {movie.title}
            </h1>

            {movie.titleHindi && (
              <p className="text-muted text-lg mb-3">{movie.titleHindi}</p>
            )}

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <RatingBadge rating={movie.rating} />
              <span className="text-muted text-sm">{movie.releaseYear}</span>
              <span className="text-muted text-sm">{movie.runtime} min</span>
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              {movie.genres.map(g => <GenreChip key={g} genre={g} />)}
              {movie.language.map(l => (
                <span key={l} className="text-xs font-medium text-gold bg-gold/10 border border-gold/20 px-2 py-0.5 rounded-full">
                  {l}
                </span>
              ))}
            </div>

            <p className="text-white/75 text-sm leading-relaxed max-w-xl mb-8">
              {movie.synopsis}
            </p>

            {/* CTA */}
            {workingSources.length > 0 && (
              <Link
                href={`/watch/${movie.slug}`}
                className="inline-flex items-center gap-2 bg-crimson hover:bg-crimson-dark text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-colors shadow-crimson-glow"
              >
                ▶ Watch Now
              </Link>
            )}
          </div>
        </div>

        {/* Cast */}
        {movie.cast.length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-semibold mb-4">Cast</h2>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
              {movie.cast.slice(0, 10).map((member, i) => (
                <div key={i} className="flex-shrink-0 text-center w-20">
                  <div className="w-16 h-16 mx-auto rounded-full overflow-hidden bg-white/10 ring-1 ring-white/10 mb-2">
                    {member.photo ? (
                      <Image src={member.photo} alt={member.name} width={64} height={64} className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl text-muted">
                        {member.name[0]}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-white font-medium line-clamp-1">{member.name}</p>
                  {member.character && (
                    <p className="text-xs text-muted line-clamp-1">{member.character}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trailer */}
        {movie.trailerKey && (
          <div className="mt-12">
            <h2 className="text-lg font-semibold mb-4">Trailer</h2>
            <div className="relative aspect-video max-w-2xl rounded-xl overflow-hidden">
              <iframe
                src={`https://www.youtube.com/embed/${movie.trailerKey}`}
                title={`${movie.title} Trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
                sandbox="allow-scripts allow-same-origin allow-presentation"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify movie detail page in browser**

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000/movie/any-slug` — with no data, should show 404 (Next.js notFound()). With a real slug from the DB, should show the full detail page.

- [ ] **Step 3: Run all tests**

```bash
npx jest
```

Expected: all tests pass.

- [ ] **Step 4: Build check**

```bash
npm run build
```

Expected: build succeeds with no TypeScript or lint errors. Fix any errors before committing.

- [ ] **Step 5: Commit and push**

```bash
cd .. && git add frontend/src/app/movie/ && git commit -m "feat(frontend): movie detail page with cast, trailer, and Watch CTA"
git push
```

---

## Self-Review

**Spec coverage:**
- Homepage: Hero (full-bleed, stagger animation) + Carousels (Trending, Latest, Hindi, Dubbed, English) ✓
- Browse page: Grid + FilterSidebar (Genre, Language, Year) + animated slide-in drawer ✓
- Search page: Debounced real-time search + results grid ✓
- Movie Detail: Backdrop hero, poster, metadata, cast scroll, trailer iframe, Watch CTA ✓
- Crimson Gold palette (`#0A0A0F`, `#C41E3A`, `#F5A623`) applied throughout ✓
- Glassmorphism: `glass` utility on Navbar + filter drawer ✓
- Framer Motion: Hero stagger, MovieCard hover scale + glow, FilterSidebar spring slide ✓
- `next/image` with TMDB remote pattern ✓
- iframe sandboxed: `sandbox="allow-scripts allow-same-origin allow-presentation"` (no popups, no top-navigation) ✓
- `'use client'` boundary respected — Server Components fetch data, Client Components animate ✓

**Not in this plan (Plan 4):**
- Watch page (Video.js + HLS.js player + iframe fallback + server switcher)
- Admin login + dashboard
