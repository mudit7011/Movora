'use client'

// All admin calls go through the Next.js proxy (/api/ctrl/...)
// so the browser never makes a direct HTTP call to the EB backend.
const BASE = '/api/ctrl'

function getToken() {
  return typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null
}

function headers() {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export const adminApi = {
  async login(email: string, password: string) {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')
    if (data.token) sessionStorage.setItem('admin_token', data.token)
    return data
  },

  logout() {
    sessionStorage.removeItem('admin_token')
  },

  isLoggedIn() {
    return !!getToken()
  },

  async getStats() {
    const res = await fetch(`${BASE}/movies`, { headers: headers() })
    if (!res.ok) throw new Error('Unauthorized')
    const movies: any[] = await res.json()
    const total = movies.length
    const totalMovies = movies.filter(m => m.type === 'movie').length
    const totalShows  = movies.filter(m => m.type === 'tvshow').length
    const recentMovies = movies.slice(0, 8)
    return { total, totalMovies, totalShows, recentMovies }
  },

  async getMovies(page = 1, search = '') {
    const res = await fetch(`${BASE}/movies`, { headers: headers() })
    if (!res.ok) throw new Error('Unauthorized')
    let movies: any[] = await res.json()
    if (search) {
      const q = search.toLowerCase()
      movies = movies.filter(m => m.title.toLowerCase().includes(q) || m.slug.includes(q))
    }
    const pageSize = 30
    const total = movies.length
    const items = movies.slice((page - 1) * pageSize, page * pageSize)
    return { items, total, pages: Math.ceil(total / pageSize) }
  },

  async deleteMovie(id: string) {
    const res = await fetch(`${BASE}/movies/${id}`, {
      method: 'DELETE',
      headers: headers(),
    })
    if (!res.ok) throw new Error('Delete failed')
  },

  async triggerScrape() {
    const res = await fetch(`${BASE}/scrape/trigger`, {
      method: 'POST',
      headers: headers(),
    })
    if (!res.ok) throw new Error('Trigger failed')
    return res.json()
  },

  async getScrapeJobs() {
    const res = await fetch(`${BASE}/scrape/jobs`, { headers: headers() })
    if (!res.ok) throw new Error('Unauthorized')
    return res.json() as Promise<any[]>
  },
}
