import type { Movie, PaginatedMovies, MovieFilters, EpisodeInfo } from '@/types/movie'

// In the browser, use relative URL so requests go through the Next.js rewrite proxy
// (avoids mixed-content blocking when backend is HTTP and frontend is HTTPS).
// On the server (SSR), use BACKEND_URL (runtime env var, not inlined at build time).
const API_URL = typeof window === 'undefined'
  ? (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')
  : ''

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

  // TV Shows
  getTrendingShows: () => apiFetch<Movie[]>('/api/shows/trending'),
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
