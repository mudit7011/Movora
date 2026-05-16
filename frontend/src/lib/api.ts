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
