import { Router } from 'express'
import { Movie } from '../models/Movie'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { page = '1', limit = '20', genre, year, language, minRating } = req.query
    const filter: Record<string, unknown> = {}

    if (genre && typeof genre === 'string') filter.genres = genre
    if (year) filter.releaseYear = Number(year)
    if (language && typeof language === 'string') filter.language = language
    if (minRating) filter.rating = { $gte: Number(minRating) }

    const skip = (Number(page) - 1) * Number(limit)
    const [movies, total] = await Promise.all([
      Movie.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).select('-sources'),
      Movie.countDocuments(filter),
    ])

    res.json({ movies, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/trending', async (_req, res) => {
  try {
    const movies = await Movie.find({ rating: { $gte: 6 } })
      .sort({ rating: -1, createdAt: -1 })
      .limit(10)
      .select('-sources')
    res.json(movies)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/latest', async (_req, res) => {
  try {
    const movies = await Movie.find().sort({ createdAt: -1 }).limit(10).select('-sources')
    res.json(movies)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/search', async (req, res) => {
  try {
    const { q } = req.query
    if (!q || typeof q !== 'string') return res.json([])

    const movies = await Movie.find(
      { $text: { $search: q } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(20)
      .select('-sources')

    res.json(movies)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/:slug', async (req, res) => {
  try {
    const movie = await Movie.findOne({ slug: req.params.slug })
    if (!movie) return res.status(404).json({ error: 'Movie not found' })
    res.json(movie)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

export { router as moviesRouter }
