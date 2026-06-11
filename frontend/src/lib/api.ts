import type { Movie, PaginatedMovies, MovieFilters, EpisodeInfo } from '@/types/movie'

// In the browser, use relative URL so requests go through the Next.js rewrite proxy
// (avoids mixed-content blocking when backend is HTTP and frontend is HTTPS).
// On the server (SSR), use BACKEND_URL (runtime env var, not inlined at build time).
const API_URL = typeof window === 'undefined'
  ? (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')
  : ''

const SSR_HEADERS: Record<string, string> =
  typeof window === 'undefined' && process.env.INTERNAL_API_TOKEN
    ? { 'x-internal-token': process.env.INTERNAL_API_TOKEN }
    : {}

// Cache TTLs (seconds). 0 = no-store (always fresh). Used only in server-side fetches.
export const CACHE = {
  MOVIE: 3600,       // individual movie/show detail — stable metadata
  SHOW: 3600,
  RELATED: 3600,     // related/similar — changes rarely
  HOMEPAGE: 900,     // trending/now-playing carousels — refresh every 15 min
  BROWSE: 300,       // paginated browse/filter pages — refresh every 5 min
  EPISODES: 3600,    // season episode lists — rarely change
  SEARCH: 0,         // search — always fresh, user-driven
  NEW: 300,          // new arrivals — refresh every 5 min
  PLATFORMS: 3600,   // provider list — rarely changes
} as const

async function apiFetch<T>(path: string, init?: RequestInit, revalidate?: number): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  const cacheConfig: RequestInit = revalidate !== undefined && revalidate > 0
    ? ({ next: { revalidate } } as RequestInit)
    : { cache: 'no-store' }
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...SSR_HEADERS, ...(init?.headers ?? {}) },
      signal: controller.signal,
      ...cacheConfig,
    })
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json() as Promise<T>
  } finally {
    clearTimeout(timer)
  }
}

export type RealtimePage = { results: Movie[]; page: number; totalPages: number }

async function realtimeFetch(path: string, page = 1, revalidate: number = CACHE.HOMEPAGE): Promise<RealtimePage> {
  const data = await apiFetch<any>(`${path}?page=${page}`, undefined, revalidate)
  // old backend returns plain array, new backend returns { results, page, totalPages }
  if (Array.isArray(data)) return { results: data, page: 1, totalPages: 1 }
  return data as RealtimePage
}

export const api = {
  // Realtime homepage (always page 1, just extract results)
  getTrending:      () => realtimeFetch('/api/realtime/movies/trending').then(d => d.results),
  getNowPlaying:    () => realtimeFetch('/api/realtime/movies/now-playing').then(d => d.results),
  getPopularMovies: () => realtimeFetch('/api/realtime/movies/popular').then(d => d.results),
  getTopRatedMovies:() => realtimeFetch('/api/realtime/movies/top-rated').then(d => d.results),
  getHindiMovies:   () => realtimeFetch('/api/realtime/movies/hindi').then(d => d.results),
  getKoreanMovies:  () => realtimeFetch('/api/realtime/movies/korean').then(d => d.results),
  getJapaneseMovies:() => realtimeFetch('/api/realtime/movies/japanese').then(d => d.results),

  // Paginated realtime — for category browse pages
  getRealtimeMovies: (cat: string, page: number) => realtimeFetch(`/api/realtime/movies/${cat}`, page, CACHE.BROWSE),
  getRealtimeShows:  (cat: string, page: number) => realtimeFetch(`/api/realtime/shows/${cat}`, page, CACHE.BROWSE),

  // Browse / search pages
  getLatest: () => apiFetch<Movie[]>('/api/movies/latest', undefined, CACHE.NEW),
  getByLanguage: (lang: string) => apiFetch<Movie[]>(`/api/movies/by-language/${encodeURIComponent(lang)}`, undefined, CACHE.BROWSE),
  getMovies: (filters: MovieFilters = {}) => {
    const params = new URLSearchParams(filters as Record<string, string>)
    return apiFetch<PaginatedMovies>(`/api/movies?${params}`, undefined, CACHE.BROWSE)
  },
  search: (q: string) =>
    apiFetch<Movie[]>(`/api/movies/search?q=${encodeURIComponent(q)}`, undefined, CACHE.SEARCH),
  searchByActor: (q: string) =>
    apiFetch<{ person: { id: number; name: string; photo: string | null } | null; results: Movie[] }>(
      `/api/search/actor?q=${encodeURIComponent(q)}`,
      undefined,
      CACHE.SEARCH,
    ),
  getMovie: (slug: string) => apiFetch<Movie>(`/api/movies/${slug}`, undefined, CACHE.MOVIE),
  getRelated: (slug: string) =>
    apiFetch<{ similar: Movie[]; youMayLove: Movie[] }>(`/api/movies/related/${slug}`, undefined, CACHE.RELATED),

  // TV Shows — realtime homepage
  getTrendingShows:  () => realtimeFetch('/api/realtime/shows/trending').then(d => d.results),
  getAiringToday:    () => realtimeFetch('/api/realtime/shows/airing-today').then(d => d.results),
  getPopularShows:   () => realtimeFetch('/api/realtime/shows/popular').then(d => d.results),
  getTopRatedShows:  () => realtimeFetch('/api/realtime/shows/top-rated').then(d => d.results),
  getHindiShows:     () => realtimeFetch('/api/realtime/shows/hindi').then(d => d.results),
  getKoreanShows:    () => realtimeFetch('/api/realtime/shows/korean').then(d => d.results),
  getJapaneseShows:  () => realtimeFetch('/api/realtime/shows/japanese').then(d => d.results),

  // Browse / search — shows
  getLatestShows: () => apiFetch<Movie[]>('/api/shows/latest', undefined, CACHE.NEW),
  getShowsByLanguage: (lang: string) => apiFetch<Movie[]>(`/api/shows/by-language/${encodeURIComponent(lang)}`, undefined, CACHE.BROWSE),
  getShows: (filters: MovieFilters = {}) => {
    const params = new URLSearchParams(filters as Record<string, string>)
    return apiFetch<PaginatedMovies>(`/api/shows?${params}`, undefined, CACHE.BROWSE)
  },
  searchShows: (q: string) =>
    apiFetch<Movie[]>(`/api/shows/search?q=${encodeURIComponent(q)}`, undefined, CACHE.SEARCH),
  getShow: (slug: string) => apiFetch<Movie>(`/api/shows/${slug}`, undefined, CACHE.SHOW),
  getRelatedShows: (slug: string) =>
    apiFetch<{ similar: Movie[]; youMayLove: Movie[] }>(`/api/shows/related/${slug}`, undefined, CACHE.RELATED),
  getEpisodes: (slug: string, season: number) =>
    apiFetch<EpisodeInfo[]>(`/api/shows/${slug}/season/${season}`, undefined, CACHE.EPISODES),
  getNew: () => apiFetch<Movie[]>('/api/new', undefined, CACHE.NEW),

  // Streaming platforms
  getProviders: () => apiFetch<{ provider_id: number; provider_name: string; logo_path: string }[]>('/api/realtime/providers', undefined, CACHE.PLATFORMS),
  getPlatformContent: (slug: string, type: 'movies' | 'shows', page: number) =>
    realtimeFetch(`/api/realtime/platform/${slug}/${type}`, page, CACHE.BROWSE),
}
