import { Router, Request, Response } from 'express'
import { Movie } from '../models/Movie'
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
    } else {
      filter.language = { $in: ['Hindi', 'English'] }
    }
    // Always cap at 9.5 to exclude concert films / data anomalies; optionally floor from param
    const ratingFilter: Record<string, number> = { $lte: 9.5 }
    if (minRating) ratingFilter.$gte = Number(minRating)
    filter.rating = ratingFilter
    filter.runtime = minRuntime ? { $gte: Number(minRuntime) } : { $gte: 60 }
    filter.posterUrl = { $ne: '' }

    const pageNum  = Number(page)
    const limitNum = Number(limit)
    const skip     = (pageNum - 1) * limitNum

    let allDocs: any[]
    if (!sort || sort === 'recent') {
      allDocs = await Movie.aggregate([
        { $match: { ...filter, rating: { ...(filter.rating as object), $gte: 5 } } },
        { $addFields: { _score: { $add: [{ $multiply: ['$rating', 1.5] }, { $multiply: [{ $subtract: ['$releaseYear', 2000] }, 0.3] }] } } },
        { $sort: { _score: -1 } },
        { $project: { sources: 0, _score: 0 } },
      ])
    } else {
      const sortMap: Record<string, Record<string, 1 | -1>> = {
        rating: { rating: -1 },
        year:   { releaseYear: -1 },
      }
      const sortObj = sortMap[sort as string] ?? { releaseYear: -1 }
      allDocs = await Movie.find(filter).sort(sortObj).select('-sources').lean()
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
      .limit(60)
      .select('-sources')
    const seen = new Set<string>()
    const movies = raw.filter(m => {
      const key = `${m.title.toLowerCase().replace(/[^a-z0-9]/g, '')}_${m.releaseYear ?? ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 20)
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
    const tokens = raw.split(/\s+/).filter(Boolean)
    const escapedFull = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Pull a broad candidate set: match any token in title or titleHindi
    const anyTokenFilter = tokens.map(t => {
      const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return { $or: [{ title: { $regex: esc, $options: 'i' } }, { titleHindi: { $regex: esc, $options: 'i' } }] }
    })

    const candidates = await Movie.find({
      type: 'movie',
      $or: [
        { $and: anyTokenFilter },
        { title: { $regex: escapedFull, $options: 'i' } },
        { titleHindi: { $regex: escapedFull, $options: 'i' } },
        { synopsis: { $regex: escapedFull, $options: 'i' } },
      ],
    })
      .limit(100)
      .select('-sources')
      .lean()

    // Fuzzy-rank the candidates so typos and word-order differences still surface
    const fuse = new Fuse(candidates, {
      keys: [
        { name: 'title', weight: 2 },
        { name: 'titleHindi', weight: 1.5 },
        { name: 'synopsis', weight: 0.5 },
      ],
      threshold: 0.45,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 2,
    })

    const fuseResults = fuse.search(raw)

    // If fuse found matches, return those; otherwise fall back to candidates sorted by rating
    const ranked = fuseResults.length > 0
      ? fuseResults.map(r => r.item)
      : candidates.sort((a, b) => (b as any).rating - (a as any).rating)

    res.json(ranked.slice(0, 20))
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/related/:slug', async (req, res) => {
  try {
    const movie = await Movie.findOne({ slug: req.params.slug, type: 'movie' }).select('_id genres language rating')
    if (!movie) return res.json([])

    const topGenres = movie.genres.slice(0, 2)

    const dedup = (docs: any[]) => {
      const seen = new Set<string>()
      const unique = docs.filter(d => {
        const idKey    = String(d.tmdbId ?? '').replace(/^movie_/, '')
        const titleKey = `${String(d.title ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')}_${d.releaseYear ?? ''}`
        if (seen.has(idKey) || seen.has(titleKey)) return false
        if (idKey) seen.add(idKey)
        seen.add(titleKey)
        return true
      })
      return shuffle(unique).slice(0, 12)
    }

    const [rawSimilar, rawYouMayLove] = await Promise.all([
      Movie.find({
        _id:            { $ne: movie._id },
        genres:         { $in: topGenres },
        language:       { $in: movie.language },
        streamVerified: { $ne: false },
        rating:         { $gte: 5 },
        posterUrl:      { $ne: '' },
      }).sort({ rating: -1, releaseYear: -1 }).limit(80).select('-sources').lean(),

      Movie.find({
        _id:            { $ne: movie._id },
        genres:         { $nin: topGenres },
        language:       { $in: movie.language },
        streamVerified: { $ne: false },
        rating:         { $gte: 6.5 },
        posterUrl:      { $ne: '' },
      }).sort({ rating: -1, releaseYear: -1 }).limit(80).select('-sources').lean(),
    ])

    res.json({ similar: dedup(rawSimilar), youMayLove: dedup(rawYouMayLove) })
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
