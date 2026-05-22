import { Router } from 'express'
import { Movie } from '../models/Movie'

const router = Router()

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

    const skip = (Number(page) - 1) * Number(limit)
    const total = await Movie.countDocuments(filter)

    let movies
    if (!sort || sort === 'recent') {
      // Weighted score: mix of rating + recency
      // score = rating * 1.5 + (releaseYear - 2000) * 0.3
      movies = await Movie.aggregate([
        { $match: { ...filter, rating: { ...(filter.rating as object), $gte: 5 } } },
        { $addFields: { _score: { $add: [{ $multiply: ['$rating', 1.5] }, { $multiply: [{ $subtract: ['$releaseYear', 2000] }, 0.3] }] } } },
        { $sort: { _score: -1 } },
        { $skip: skip },
        { $limit: Number(limit) },
        { $project: { sources: 0, _score: 0 } },
      ])
    } else {
      const sortMap: Record<string, Record<string, 1 | -1>> = {
        rating: { rating: -1 },
        year:   { releaseYear: -1 },
      }
      const sortObj = sortMap[sort as string] ?? { releaseYear: -1 }
      movies = await Movie.find(filter).sort(sortObj).skip(skip).limit(Number(limit)).select('-sources')
    }

    res.json({ movies, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/trending', async (_req, res) => {
  try {
    // Trending = highly acclaimed (7.5+), sorted by rating — different from Latest
    const movies = await Movie.find({
      type:           'movie',
      streamVerified: { $ne: false },
      language:       { $in: ['Hindi', 'English'] },
      releaseYear:    { $gte: 2020 },
      rating:         { $gte: 7.5, $lte: 9.5 },
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
    // Latest = recent releases (current year), rating 5-7.4 — explicitly avoids the 7.5+ tier
    // shown in Trending so the two carousels display different content
    const movies = await Movie.find({
      type:           'movie',
      streamVerified: { $ne: false },
      language:       { $in: ['Hindi', 'English'] },
      releaseYear:    { $gte: currentYear - 1 },
      runtime:        { $gte: 60 },
      rating:         { $gte: 5, $lt: 7.5 },
      genres:         { $nin: EXCLUDED_GENRES },
      posterUrl:      { $ne: '' },
      backdropUrl:    { $ne: '' },
    })
      .sort({ releaseYear: -1, rating: -1 })
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
    const movies = await Movie.find({
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
      .limit(20)
      .select('-sources')
    res.json(movies)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/search', async (req, res) => {
  try {
    const { q } = req.query
    if (!q || typeof q !== 'string') return res.json([])

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'i')

    const movies = await Movie.aggregate([
      {
        $match: {
          type: 'movie',
          $or: [{ title: regex }, { titleHindi: regex }, { synopsis: regex }],
        },
      },
      {
        $addFields: {
          _score: {
            $switch: {
              branches: [
                { case: { $regexMatch: { input: '$title', regex: escaped, options: 'i' } }, then: 3 },
                { case: { $regexMatch: { input: { $ifNull: ['$titleHindi', ''] }, regex: escaped, options: 'i' } }, then: 2 },
              ],
              default: 1,
            },
          },
        },
      },
      { $sort: { _score: -1, rating: -1 } },
      { $limit: 20 },
      { $project: { sources: 0, _score: 0 } },
    ])

    res.json(movies)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/related/:slug', async (req, res) => {
  try {
    const movie = await Movie.findOne({ slug: req.params.slug, type: 'movie' }).select('_id genres language rating')
    if (!movie) return res.json([])

    const topGenres = movie.genres.slice(0, 2)

    const [similar, youMayLove] = await Promise.all([
      // Same genre, same language
      Movie.find({
        _id:            { $ne: movie._id },
        genres:         { $in: topGenres },
        language:       { $in: movie.language },
        streamVerified: { $ne: false },
        rating:         { $gte: 5 },
        posterUrl:      { $ne: '' },
      }).sort({ rating: -1, releaseYear: -1 }).limit(12).select('-sources'),

      // Same language, highly rated, different taste
      Movie.find({
        _id:            { $ne: movie._id },
        genres:         { $nin: topGenres },
        language:       { $in: movie.language },
        streamVerified: { $ne: false },
        rating:         { $gte: 7 },
        posterUrl:      { $ne: '' },
      }).sort({ rating: -1, releaseYear: -1 }).limit(12).select('-sources'),
    ])

    res.json({ similar, youMayLove })
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
