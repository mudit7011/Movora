import { Router, Request, Response } from 'express'
import { Movie } from '../models/Movie'
import { tmdbFetch } from '../utils/tmdb'
import { importMovie } from '../utils/importer'
import { cacheSet } from '../utils/boundedCache'
import Fuse from 'fuse.js'

const router = Router()

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Genres that are unusable on embed providers or undesirable on home page
const EXCLUDED_GENRES = ['Music', 'Talk', 'News', 'Reality', 'Soap', 'TV Movie']

router.get('/', async (req, res) => {
  try {
    const { page = '1', limit = '20', genre, year, language, minRating, minRuntime, sort = 'recent' } = req.query
    const filter: Record<string, unknown> = { type: 'movie' }

    if (genre && typeof genre === 'string') filter.genres = genre
    if (year) {
      filter.releaseYear = Number(year)
    } else {
      filter.releaseYear = { $gte: 2000 }
    }
    if (language && typeof language === 'string') {
      filter.language = language
    }
    // no default language filter — show all languages
    // Always cap at 9.5 to exclude concert films / data anomalies; optionally floor from param
    const ratingFilter: Record<string, number> = { $lte: 9.5 }
    if (minRating) ratingFilter.$gte = Number(minRating)
    filter.rating = ratingFilter
    filter.runtime = minRuntime ? { $gte: Number(minRuntime) } : { $gte: 60 }
    filter.posterUrl = { $ne: '' }

    const pageNum  = Number(page)
    const limitNum = Number(limit)
    const skip     = (pageNum - 1) * limitNum

    // Cap the candidate pool — sorting the entire collection in memory exceeds
    // MongoDB's 100MB sort limit on large catalogs and crashes the request.
    // 250 candidates = ~12 pages of 20, plenty for a browse page, and ~half the
    // docs to fetch vs 500 (each fetch is costly on free-tier Mongo).
    const CANDIDATE_CAP = 250
    // Only the fields the movie cards actually render — skips heavy cast arrays,
    // synopsis and backdrop, cutting per-doc transfer/deserialize cost massively.
    const CARD_FIELDS = 'tmdbId slug title titleHindi posterUrl rating releaseYear type genres language seasons'
    let allDocs: any[]
    if (!sort || sort === 'recent') {
      allDocs = await Movie.aggregate([
        { $match: { ...filter, rating: { ...(filter.rating as object), $gte: 5 } } },
        { $addFields: { _score: { $add: [{ $multiply: ['$rating', 1.5] }, { $multiply: [{ $subtract: ['$releaseYear', 2000] }, 0.3] }] } } },
        { $sort: { _score: -1 } },
        { $limit: CANDIDATE_CAP },
        { $project: { tmdbId: 1, slug: 1, title: 1, titleHindi: 1, posterUrl: 1, rating: 1, releaseYear: 1, type: 1, genres: 1, language: 1, seasons: 1 } },
      ]).option({ allowDiskUse: true })
    } else {
      const sortMap: Record<string, Record<string, 1 | -1>> = {
        latest: { createdAt: -1, _id: -1 },
        recent: { releaseYear: -1, rating: -1, _id: -1 },
        rating: { rating: -1, _id: -1 },
        year:   { releaseYear: -1, _id: -1 },
      }
      const sortObj = sortMap[sort as string] ?? sortMap.latest
      allDocs = await Movie.find(filter).sort(sortObj).limit(CANDIDATE_CAP).select(CARD_FIELDS).lean()
    }

    // Dedup by normalized tmdbId (strip movie_ prefix)
    const seen = new Set<string>()
    const deduped = allDocs.filter(doc => {
      const key = String(doc.tmdbId ?? '').replace(/^movie_/, '')
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })

    const total  = deduped.length
    const movies = deduped.slice(skip, skip + limitNum)

    res.json({ movies, total, page: pageNum, pages: Math.ceil(total / limitNum) })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/trending', async (_req, res) => {
  try {
    // Trending = proven hits from previous years (2020 to last year), sorted by rating
    const currentYear = new Date().getFullYear()
    const movies = await Movie.find({
      type:           'movie',
      streamVerified: { $ne: false },
      language:       { $in: ['Hindi', 'English'] },
      releaseYear:    { $gte: 2020, $lte: currentYear - 1 },
      rating:         { $gte: 7, $lte: 9.5 },
      runtime:        { $gte: 60 },
      genres:         { $nin: EXCLUDED_GENRES },
      posterUrl:      { $ne: '' },
      backdropUrl:    { $ne: '' },
    })
      .sort({ rating: -1, releaseYear: -1 })
      .limit(30)
      .select('-sources')
    const seen = new Set<string>()
    const unique = movies.filter(m => {
      const key = m.title.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 15)
    res.json(unique)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/latest', async (_req, res) => {
  try {
    const currentYear = new Date().getFullYear()
    // Latest = 2026 releases, any rating ≥ 5, sorted by rating
    const movies = await Movie.find({
      type:           'movie',
      streamVerified: { $ne: false },
      language:       { $in: ['Hindi', 'English'] },
      releaseYear:    { $gte: currentYear },
      runtime:        { $gte: 60 },
      rating:         { $gte: 5, $lte: 9.5 },
      genres:         { $nin: EXCLUDED_GENRES },
      posterUrl:      { $ne: '' },
      backdropUrl:    { $ne: '' },
    })
      .sort({ rating: -1, releaseYear: -1 })
      .limit(40)
      .select('-sources')
    const seen = new Set<string>()
    const unique = movies.filter(m => {
      const key = m.title.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 20)
    res.json(unique)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/popular', async (_req, res) => {
  try {
    const movies = await Movie.find({
      type:           'movie',
      streamVerified: { $ne: false },
      language:       { $in: ['Hindi', 'English', 'Korean', 'Japanese', 'Tamil', 'Telugu'] },
      releaseYear:    { $gte: 2015 },
      rating:         { $gte: 6.5, $lte: 9.5 },
      runtime:        { $gte: 60 },
      genres:         { $nin: EXCLUDED_GENRES },
      posterUrl:      { $ne: '' },
      backdropUrl:    { $ne: '' },
    }).sort({ rating: -1, releaseYear: -1 }).limit(60).select('-sources')
    const seen = new Set<string>()
    const unique = movies.filter(m => {
      const key = m.title.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 20)
    res.json(unique)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/top-rated', async (_req, res) => {
  try {
    const movies = await Movie.find({
      type:           'movie',
      streamVerified: { $ne: false },
      releaseYear:    { $gte: 2000 },
      rating:         { $gte: 8.0, $lte: 9.5 },
      runtime:        { $gte: 60 },
      genres:         { $nin: EXCLUDED_GENRES },
      posterUrl:      { $ne: '' },
      backdropUrl:    { $ne: '' },
    }).sort({ rating: -1, releaseYear: -1 }).limit(60).select('-sources')
    const seen = new Set<string>()
    const unique = movies.filter(m => {
      const key = m.title.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 20)
    res.json(unique)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/by-language/:lang', async (req, res) => {
  try {
    const raw = await Movie.find({
      type:           'movie',
      streamVerified: { $ne: false },
      language:       req.params.lang,
      releaseYear:    { $gte: 2000 },
      runtime:        { $gte: 60 },
      rating:         { $gte: 6, $lte: 9.5 },
      genres:         { $nin: EXCLUDED_GENRES },
      posterUrl:      { $ne: '' },
      backdropUrl:    { $ne: '' },
    })
      .sort({ rating: -1, releaseYear: -1 })
      .limit(300)
      .select('-sources')
    const seen = new Set<string>()
    const movies = raw.filter(m => {
      const key = `${m.title.toLowerCase().replace(/[^a-z0-9]/g, '')}_${m.releaseYear ?? ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    res.json(movies)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/search', async (req, res) => {
  try {
    const { q } = req.query
    if (!q || typeof q !== 'string') return res.json([])

    const raw = q.trim()
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Use MongoDB aggregation with DB-side relevance scoring — same approach as admin search.
    // This guarantees title matches always surface before synopsis matches, regardless of
    // collection size or insertion order, avoiding Fuse.js threshold/ranking issues.
    const results = await Movie.aggregate([
      {
        $match: {
          type: 'movie',
          $or: [
            { title:      { $regex: esc, $options: 'i' } },
            { titleHindi: { $regex: esc, $options: 'i' } },
            { synopsis:   { $regex: esc, $options: 'i' } },
          ],
        },
      },
      {
        $addFields: {
          _rel: {
            $switch: {
              branches: [
                { case: { $regexMatch: { input: '$title', regex: `^${esc}$`, options: 'i' } }, then: 0 },
                { case: { $regexMatch: { input: '$title', regex: `^${esc}`,  options: 'i' } }, then: 1 },
                { case: { $regexMatch: { input: '$title', regex: esc,         options: 'i' } }, then: 2 },
                { case: { $regexMatch: { input: { $ifNull: ['$titleHindi', ''] }, regex: esc, options: 'i' } }, then: 3 },
              ],
              default: 4,
            },
          },
        },
      },
      { $sort: { _rel: 1, rating: -1 } },
      { $limit: 20 },
      { $project: { sources: 0, _rel: 0 } },
    ])

    const seenKeys = new Set<string>()
    const deduped = results.filter((item: any) => {
      const key = String(item.tmdbId ?? '').replace(/^movie_/, '') || String(item._id)
      if (seenKeys.has(key)) return false
      seenKeys.add(key)
      return true
    })

    res.json(deduped.slice(0, 20))
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

const relatedCache = new Map<string, { data: any; ts: number }>()
const RELATED_TTL = 6 * 60 * 60 * 1000 // 6 hours
const RELATED_MAX = 300                 // cap entries so a crawler can't grow it unbounded

router.get('/related/:slug', async (req, res) => {
  try {
    const cached = relatedCache.get(req.params.slug)
    if (cached && Date.now() - cached.ts < RELATED_TTL) return res.json(cached.data)

    const movie = await Movie.findOne({ slug: req.params.slug, type: 'movie' }).select('_id tmdbId genres language rating')
    if (!movie) return res.json({ similar: [], youMayLove: [] })

    const rawId = String(movie.tmdbId ?? '').replace(/^movie_/, '')
    const movieId = String(movie._id)

    // Pick up to 12 unique, poster-having docs; `seen` is shared so the two rows don't overlap.
    const pick = (docs: any[], seen: Set<string>) => {
      const out: any[] = []
      for (const d of docs) {
        const key = String(d?.tmdbId ?? '').replace(/^movie_/, '')
        if (!key || seen.has(key) || !d.posterUrl) continue
        seen.add(key)
        out.push(d)
        if (out.length >= 12) break
      }
      return out
    }

    // Return the TMDB-recommended titles that ALREADY exist in our DB — no importing.
    async function dbMatches(tmdbItems: any[]): Promise<any[]> {
      if (!tmdbItems.length) return []
      const ids = tmdbItems.map(r => String(r.id))
      const existing = await Movie.find({ tmdbId: { $in: ids }, type: 'movie' }).select('-sources').lean()
      const byId = new Map(existing.map((m: any) => [String(m.tmdbId).replace(/^movie_/, ''), m]))
      return tmdbItems
        .map(r => byId.get(String(r.id)))
        .filter((d): d is any => !!d && !!d.posterUrl && String(d._id) !== movieId)
    }

    // TMDB recommendations/similar (only used to rank what we already have)
    let recMatches: any[] = []
    let simMatches: any[] = []
    if (rawId) {
      const [recData, simData] = await Promise.allSettled([
        tmdbFetch(`/movie/${rawId}/recommendations?language=en-US&page=1`),
        tmdbFetch(`/movie/${rawId}/similar?language=en-US&page=1`),
      ])
      recMatches = await dbMatches(recData.status === 'fulfilled' ? (recData.value.results || []) : [])
      simMatches = await dbMatches(simData.status === 'fulfilled' ? (simData.value.results || []) : [])
    }

    // Top up from our DB by genre/language so rows stay full — still no imports.
    const topGenres = movie.genres.slice(0, 2)
    const [genrePool, broadPool] = await Promise.all([
      Movie.find({ _id: { $ne: movie._id }, genres: { $in: topGenres }, language: { $in: movie.language }, streamVerified: { $ne: false }, rating: { $gte: 5 }, posterUrl: { $ne: '' } }).sort({ rating: -1, releaseYear: -1 }).limit(80).select('-sources').lean(),
      Movie.find({ _id: { $ne: movie._id }, genres: { $nin: topGenres }, language: { $in: movie.language }, streamVerified: { $ne: false }, rating: { $gte: 6.5 }, posterUrl: { $ne: '' } }).sort({ rating: -1, releaseYear: -1 }).limit(80).select('-sources').lean(),
    ])

    const seen = new Set<string>([rawId]) // never include the movie itself
    const result = {
      similar:    pick([...recMatches, ...shuffle(genrePool as any[])], seen),
      youMayLove: pick([...simMatches, ...shuffle(broadPool as any[])], seen),
    }
    cacheSet(relatedCache, req.params.slug, { data: result, ts: Date.now() }, RELATED_MAX)
    res.json(result)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// Return slugs for collection parts that actually exist — accepts tmdbIds (bare numbers).
// Missing parts are imported on the spot (quality-gate bypassed) so franchise
// collections show complete, even classic pre-2000 entries. Strictly limited to the
// requested collection part ids — nothing else is ever pulled in.
router.get('/check-collection', async (req, res) => {
  try {
    const raw = req.query.ids
    if (!raw || typeof raw !== 'string') return res.json([])
    const ids = raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 30)

    const buildMap = async () => {
      const orList = ids.flatMap(id => [id, `movie_${id}`])
      const found = await Movie.find({ tmdbId: { $in: orList }, type: 'movie' }).select('tmdbId slug').lean()
      const map: Record<string, string> = {}
      for (const m of found) map[String(m.tmdbId).replace(/^movie_/, '')] = m.slug
      return map
    }

    let result = await buildMap()

    // Import only the requested parts we don't already have (gate bypassed).
    const missing = ids.filter(id => !result[id])
    if (missing.length) {
      for (let i = 0; i < missing.length; i += 5) {
        await Promise.allSettled(missing.slice(i, i + 5).map(id => importMovie(Number(id), { bypassGate: true })))
      }
      result = await buildMap()
    }

    res.json(result)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/:slug', async (req, res) => {
  try {
    const movie = await Movie.findOne({ slug: req.params.slug, type: 'movie' })
    if (!movie) return res.status(404).json({ error: 'Movie not found' })
    res.json(movie)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

export { router as moviesRouter }
