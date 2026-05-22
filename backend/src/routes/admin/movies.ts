import { Router } from 'express'
import { z } from 'zod'
import mongoose from 'mongoose'
import { Movie } from '../../models/Movie'
import { authenticate } from '../../middleware/authenticate'

const router = Router()
router.use(authenticate)

const sourceSchema = z.object({
  serverName: z.string(),
  url: z.string().url(),
  type: z.enum(['iframe', 'direct']),
  quality: z.string().default('HD'),
  isWorking: z.boolean().default(true),
})

const movieSchema = z.object({
  tmdbId: z.string(),
  title: z.string(),
  titleHindi: z.string().optional(),
  slug: z.string(),
  language: z.array(z.string()),
  genres: z.array(z.string()),
  releaseYear: z.number(),
  rating: z.number(),
  runtime: z.number(),
  synopsis: z.string(),
  posterUrl: z.string().url(),
  backdropUrl: z.string().url(),
  trailerKey: z.string().optional(),
  cast: z.array(z.object({ name: z.string(), character: z.string().optional(), photo: z.string().optional() })),
  sources: z.array(sourceSchema),
  scrapedFrom: z.string(),
})

router.get('/', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 30))
    const search = ((req.query.search as string) || '').trim()

    const filter: Record<string, unknown> = {}
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { slug:  { $regex: search, $options: 'i' } },
      ]
    }

    const [movies, total] = await Promise.all([
      Movie.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('title slug type language releaseYear rating sources posterUrl tmdbId'),
      Movie.countDocuments(filter),
    ])

    res.json({ movies, total, page, pages: Math.ceil(total / limit) })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/', async (req, res) => {
  const parsed = movieSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues })
    return
  }
  try {
    const movie = await Movie.create(parsed.data)
    res.status(201).json(movie)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.patch('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: 'Invalid movie id' })
    return
  }
  const parsed = movieSchema.partial().safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues })
    return
  }
  try {
    const movie = await Movie.findByIdAndUpdate(
      req.params.id,
      { $set: parsed.data },
      { new: true, runValidators: true }
    )
    if (!movie) {
      res.status(404).json({ error: 'Movie not found' })
      return
    }
    res.json(movie)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: 'Invalid movie id' })
    return
  }
  try {
    const movie = await Movie.findByIdAndDelete(req.params.id)
    if (!movie) {
      res.status(404).json({ error: 'Movie not found' })
      return
    }
    res.json({ message: 'Deleted' })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

export { router as adminMoviesRouter }
