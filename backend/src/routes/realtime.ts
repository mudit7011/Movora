import { Router } from 'express'
import { Movie } from '../models/Movie'
import { tmdbFetch } from '../utils/tmdb'
import { importMovie, importShow } from '../utils/importer'

const router = Router()

// In-memory cache: fresh for 1 hour, then TMDB is re-fetched
const cache = new Map<string, { docs: any[]; ts: number; totalPages: number }>()
const TTL   = 24 * 60 * 60 * 1000 // 24 hours

const MOVIE_ENDPOINTS: Record<string, string> = {
  trending:    '/trending/movie/week?language=en-US',
  popular:     '/movie/popular?language=en-US',
  'top-rated': '/movie/top_rated?language=en-US',
  'now-playing': '/movie/now_playing?language=en-US',
  hindi:       '/discover/movie?with_original_language=hi&sort_by=popularity.desc&language=en-US',
  korean:      '/discover/movie?with_original_language=ko&sort_by=popularity.desc&language=en-US',
  japanese:    '/discover/movie?with_original_language=ja&sort_by=popularity.desc&primary_release_date.gte=2001-01-01&language=en-US',
}

// 10766 = Soap, 10763 = News, 10767 = Talk Show — exclude all three
const NO_SERIALS = 'without_genres=10766,10763,10767&vote_count.gte=50&vote_average.gte=5'

const SHOW_ENDPOINTS: Record<string, string> = {
  trending:       '/trending/tv/week?language=en-US',
  popular:        `/tv/popular?language=en-US`,
  'top-rated':    `/tv/top_rated?language=en-US`,
  'airing-today': `/tv/airing_today?language=en-US`,
  hindi:          `/discover/tv?with_original_language=hi&sort_by=popularity.desc&${NO_SERIALS}&language=en-US`,
  korean:         `/discover/tv?with_original_language=ko&sort_by=popularity.desc&${NO_SERIALS}&language=en-US`,
  japanese:       `/discover/tv?with_original_language=ja&sort_by=popularity.desc&${NO_SERIALS}&language=en-US`,
}

function injectPage(endpoint: string, page: number): string {
  if (endpoint.includes('page=')) return endpoint.replace(/page=\d+/, `page=${page}`)
  return endpoint + `&page=${page}`
}

async function getRealtime(
  cacheKey: string,
  tmdbEndpoint: string,
  mediaType: 'movie' | 'tv',
  page = 1
): Promise<{ docs: any[]; totalPages: number }> {
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.ts < TTL) return { docs: hit.docs, totalPages: hit.totalPages ?? 1 }

  // 1. Fetch TMDB list (1 call)
  const data    = await tmdbFetch(injectPage(tmdbEndpoint, page))
  const results: any[] = data.results || []
  const totalPages: number = Math.min(data.total_pages ?? 1, 10) // cap at 10 pages

  // 2. Batch check which IDs already exist in DB
  const tmdbIds = results.map(r => mediaType === 'movie' ? String(r.id) : `tv_${r.id}`)
  const existing = await Movie.find({ tmdbId: { $in: tmdbIds } }).select('-sources').lean()
  const byId = new Map<string, any>(existing.map(m => [String(m.tmdbId), m]))

  // 3. Import missing items in batches of 5 (parallel within batch, sequential across)
  const missing = results.filter(r => !byId.has(mediaType === 'movie' ? String(r.id) : `tv_${r.id}`))
  for (let i = 0; i < missing.length; i += 5) {
    const batch = missing.slice(i, i + 5)
    await Promise.allSettled(
      batch.map(r => mediaType === 'movie' ? importMovie(r.id) : importShow(r.id))
    )
  }

  // 4. Re-fetch newly imported docs
  if (missing.length > 0) {
    const newIds = missing.map(r => mediaType === 'movie' ? String(r.id) : `tv_${r.id}`)
    const newDocs = await Movie.find({ tmdbId: { $in: newIds } }).select('-sources').lean()
    for (const d of newDocs) byId.set(String(d.tmdbId), d)
  }

  const EXCLUDED_GENRES = ['Music', 'Talk', 'News', 'Reality', 'Soap']

  // 5. Return in TMDB rank order — filter serials, excluded genres, missing posters
  const docs = results
    .map(r => byId.get(mediaType === 'movie' ? String(r.id) : `tv_${r.id}`))
    .filter((d): d is any => {
      if (!d || !d.posterUrl) return false
      // Drop excluded genres
      if (d.genres?.some((g: string) => EXCLUDED_GENRES.includes(g))) return false
      // Drop daily soaps: any season with >100 episodes
      if (d.seasonData?.some((s: any) => s.episodeCount > 100)) return false
      return true
    })

  cache.set(cacheKey, { docs, ts: Date.now(), totalPages })
  return { docs, totalPages }
}

router.get('/movies/:category', async (req, res) => {
  const endpoint = MOVIE_ENDPOINTS[req.params.category]
  if (!endpoint) { res.status(400).json({ error: 'Unknown category' }); return }
  const page = Math.max(1, Number(req.query.page ?? 1))
  try {
    const { docs, totalPages } = await getRealtime(`m:${req.params.category}:${page}`, endpoint, 'movie', page)
    res.json({ results: docs, page, totalPages })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/shows/:category', async (req, res) => {
  const endpoint = SHOW_ENDPOINTS[req.params.category]
  if (!endpoint) { res.status(400).json({ error: 'Unknown category' }); return }
  const page = Math.max(1, Number(req.query.page ?? 1))
  try {
    const { docs, totalPages } = await getRealtime(`s:${req.params.category}:${page}`, endpoint, 'tv', page)
    res.json({ results: docs, page, totalPages })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

export function clearRealtimeCache() {
  cache.clear()
}

export { router as realtimeRouter }
