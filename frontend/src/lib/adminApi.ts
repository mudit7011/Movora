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

async function checkRes(res: Response) {
  if (!res.ok) {
    let msg = `Error ${res.status}`
    try {
      const body = await res.json()
      msg = body.error || msg
    } catch {}
    throw new Error(msg)
  }
  return res
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
    const res = await fetch(`${BASE}/movies?page=1&limit=8`, { headers: headers() })
    await checkRes(res)
    const data = await res.json()
    // backend now returns { movies, total, page, pages }
    const movies: any[] = data.movies ?? data
    const total = data.total ?? movies.length
    const totalMovies = movies.filter((m: any) => m.type === 'movie').length
    const totalShows  = movies.filter((m: any) => m.type === 'tvshow').length
    return { total, totalMovies, totalShows, recentMovies: movies }
  },

  async getMovies(page = 1, search = '') {
    const params = new URLSearchParams({ page: String(page), limit: '30' })
    if (search) params.set('search', search)
    const res = await fetch(`${BASE}/movies?${params}`, { headers: headers() })
    await checkRes(res)
    const data = await res.json()
    // backend returns { movies, total, page, pages }
    return { items: data.movies ?? data, total: data.total ?? 0, pages: data.pages ?? 1 }
  },

  async deleteMovie(id: string) {
    const res = await fetch(`${BASE}/movies/${id}`, {
      method: 'DELETE',
      headers: headers(),
    })
    await checkRes(res)
  },

  async triggerScrape() {
    const res = await fetch(`${BASE}/scrape/trigger`, {
      method: 'POST',
      headers: headers(),
    })
    await checkRes(res)
    return res.json()
  },

  async getScrapeJobs() {
    const res = await fetch(`${BASE}/scrape/jobs`, { headers: headers() })
    await checkRes(res)
    return res.json() as Promise<any[]>
  },
}
