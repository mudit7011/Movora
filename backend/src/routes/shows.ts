import { Router } from 'express'
import { Movie } from '../models/Movie'
import { tmdbFetch } from '../utils/tmdb'

const IMG_STILL = 'https://image.tmdb.org/t/p/w300'

const router = Router()

const EXCLUDED_GENRES = ['Music', 'Talk', 'News', 'Reality', 'Soap']

// Exclude Hindi daily soaps: Hindi shows with any season >100 eps are daily serials.
// English/other shows (One Piece, Naruto etc.) are exempt from this cap.
const NOT_DAILY_SOAP = {
  $or: [
    { language: { $nin: ['Hindi'] } },
    { $nor: [{ 'seasonData.episodeCount': { $gt: 100 } }] },
  ],
}

router.get('/', async (req, res) => {
  try {
    const { page = '1', limit = '20', genre, year, language, minRating, sort = 'recent' } = req.query
    const filter: Record<string, unknown> = { type: 'tvshow' }

    if (genre && typeof genre === 'string') {
      filter.genres = { $regex: genre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
    }
    if (year) filter.releaseYear = Number(year)
    if (language && typeof language === 'string') {
      filter.language = language
    } else {
      filter.language = { $in: ['Hindi', 'English'] }
    }
    if (minRating) filter.rating = { $gte: Number(minRating) }

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      recent: { releaseYear: -1, rating: -1 },
      rating: { rating: -1 },
      year:   { releaseYear: -1 },
    }
    const sortObj = sortMap[sort as string] ?? sortMap.recent

    const skip = (Number(page) - 1) * Number(limit)
    const browseFilter = { ...filter, ...NOT_DAILY_SOAP, genres: { $nin: EXCLUDED_GENRES }, posterUrl: { $ne: '' } }
    const [shows, total] = await Promise.all([
      Movie.find(browseFilter).sort(sortObj).skip(skip).limit(Number(limit)).select('-sources'),
      Movie.countDocuments(browseFilter),
    ])

    res.json({ movies: shows, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/trending', async (_req, res) => {
  try {
    const shows = await Movie.find({
      type:           'tvshow',
      streamVerified: { $ne: false },
      language:       { $in: ['Hindi', 'English'] },
      releaseYear:    { $gte: 2022 },
      rating:         { $gte: 6, $lte: 9.5 },
      genres:         { $nin: EXCLUDED_GENRES },
      posterUrl:      { $ne: '' },
      backdropUrl:    { $ne: '' },
      ...NOT_DAILY_SOAP,
    })
      .sort({ releaseYear: -1, rating: -1 })
      .limit(15)
      .select('-sources')
    res.json(shows)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/latest', async (_req, res) => {
  try {
    const currentYear = new Date().getFullYear()
    const shows = await Movie.find({
      type:           'tvshow',
      streamVerified: { $ne: false },
      language:       { $in: ['Hindi', 'English'] },
      releaseYear:    { $gte: currentYear },
      rating:         { $gte: 5, $lte: 9.5 },
      genres:         { $nin: EXCLUDED_GENRES },
      posterUrl:      { $ne: '' },
      backdropUrl:    { $ne: '' },
      ...NOT_DAILY_SOAP,
    })
      .sort({ releaseYear: -1 })
      .limit(20)
      .select('-sources')
    res.json(shows)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/by-language/:lang', async (req, res) => {
  try {
    const shows = await Movie.find({
      type:           'tvshow',
      streamVerified: { $ne: false },
      language:       req.params.lang,
      rating:         { $gte: 5, $lte: 9.5 },
      genres:         { $nin: EXCLUDED_GENRES },
      posterUrl:      { $ne: '' },
      backdropUrl:    { $ne: '' },
      ...NOT_DAILY_SOAP,
    })
      .sort({ releaseYear: -1 })
      .limit(20)
      .select('-sources')
    res.json(shows)
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

    const shows = await Movie.aggregate([
      {
        $match: {
          type: 'tvshow',
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

    res.json(shows)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/:slug/season/:n', async (req, res) => {
  try {
    const show = await Movie.findOne({ slug: req.params.slug, type: 'tvshow' }).select('tmdbId')
    if (!show) return res.status(404).json({ error: 'Show not found' })

    const rawId = show.tmdbId.replace(/^tv_/, '')
    const season = parseInt(req.params.n)
    if (!rawId || isNaN(season)) return res.status(400).json({ error: 'Invalid params' })

    const data = await tmdbFetch(`/tv/${rawId}/season/${season}?language=en-US`)
    const episodes = (data.episodes || []).map((ep: any) => ({
      episodeNumber: ep.episode_number,
      name: ep.name || `Episode ${ep.episode_number}`,
      overview: ep.overview || '',
      runtime: ep.runtime || 0,
      stillUrl: ep.still_path ? `${IMG_STILL}${ep.still_path}` : '',
      airDate: ep.air_date || '',
    }))

    res.json(episodes)
  } catch {
    res.json([]) // return empty array on TMDB failure — client falls back gracefully
  }
})

router.get('/related/:slug', async (req, res) => {
  try {
    const show = await Movie.findOne({ slug: req.params.slug, type: 'tvshow' }).select('_id genres language rating')
    if (!show) return res.json({ similar: [], youMayLove: [] })

    const topGenres = show.genres.slice(0, 2)

    const [similar, youMayLove] = await Promise.all([
      Movie.find({
        _id:            { $ne: show._id },
        type:           'tvshow',
        genres:         { $in: topGenres },
        language:       { $in: show.language },
        streamVerified: { $ne: false },
        rating:         { $gte: 5 },
        posterUrl:      { $ne: '' },
      }).sort({ rating: -1, releaseYear: -1 }).limit(12).select('-sources'),

      Movie.find({
        _id:            { $ne: show._id },
        type:           'tvshow',
        genres:         { $nin: topGenres },
        language:       { $in: show.language },
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
    const show = await Movie.findOne({ slug: req.params.slug, type: 'tvshow' })
    if (!show) return res.status(404).json({ error: 'Show not found' })
    res.json(show)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

export { router as showsRouter }
