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

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...SSR_HEADERS, ...(init?.headers ?? {}) },
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json() as Promise<T>
  } finally {
    clearTimeout(timer)
  }
}

export type RealtimePage = { results: Movie[]; page: number; totalPages: number }

async function realtimeFetch(path: string, page = 1): Promise<RealtimePage> {
  const data = await apiFetch<any>(`${path}?page=${page}`)
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
  getRealtimeMovies: (cat: string, page: number) => realtimeFetch(`/api/realtime/movies/${cat}`, page),
  getRealtimeShows:  (cat: string, page: number) => realtimeFetch(`/api/realtime/shows/${cat}`, page),

  // kept for browse/search pages
  getLatest: () => apiFetch<Movie[]>('/api/movies/latest'),
  getByLanguage: (lang: string) => apiFetch<Movie[]>(`/api/movies/by-language/${encodeURIComponent(lang)}`),
  getMovies: (filters: MovieFilters = {}) => {
    const params = new URLSearchParams(filters as Record<string, string>)
    return apiFetch<PaginatedMovies>(`/api/movies?${params}`)
  },
  search: (q: string) =>
    apiFetch<Movie[]>(`/api/movies/search?q=${encodeURIComponent(q)}`),
  getMovie: (slug: string) => apiFetch<Movie>(`/api/movies/${slug}`),
  getRelated: (slug: string) =>
    apiFetch<{ similar: Movie[]; youMayLove: Movie[] }>(`/api/movies/related/${slug}`),

  // TV Shows — realtime homepage
  getTrendingShows:  () => realtimeFetch('/api/realtime/shows/trending').then(d => d.results),
  getAiringToday:    () => realtimeFetch('/api/realtime/shows/airing-today').then(d => d.results),
  getPopularShows:   () => realtimeFetch('/api/realtime/shows/popular').then(d => d.results),
  getTopRatedShows:  () => realtimeFetch('/api/realtime/shows/top-rated').then(d => d.results),
  getHindiShows:     () => realtimeFetch('/api/realtime/shows/hindi').then(d => d.results),
  getKoreanShows:    () => realtimeFetch('/api/realtime/shows/korean').then(d => d.results),
  getJapaneseShows:  () => realtimeFetch('/api/realtime/shows/japanese').then(d => d.results),

  // kept for browse/search pages
  getLatestShows: () => apiFetch<Movie[]>('/api/shows/latest'),
  getShowsByLanguage: (lang: string) => apiFetch<Movie[]>(`/api/shows/by-language/${encodeURIComponent(lang)}`),
  getShows: (filters: MovieFilters = {}) => {
    const params = new URLSearchParams(filters as Record<string, string>)
    return apiFetch<PaginatedMovies>(`/api/shows?${params}`)
  },
  searchShows: (q: string) =>
    apiFetch<Movie[]>(`/api/shows/search?q=${encodeURIComponent(q)}`),
  getShow: (slug: string) => apiFetch<Movie>(`/api/shows/${slug}`),
  getRelatedShows: (slug: string) =>
    apiFetch<{ similar: Movie[]; youMayLove: Movie[] }>(`/api/shows/related/${slug}`),
  getEpisodes: (slug: string, season: number) =>
    apiFetch<EpisodeInfo[]>(`/api/shows/${slug}/season/${season}`),
  getNew: () => apiFetch<Movie[]>('/api/new'),
}
