import { Router } from 'express'
import { Movie } from '../models/Movie'
import { tmdbFetch } from '../utils/tmdb'
import Fuse from 'fuse.js'

const IMG_STILL = 'https://image.tmdb.org/t/p/w300'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

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

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      recent: { releaseYear: -1, rating: -1 },
      rating: { rating: -1 },
      year:   { releaseYear: -1 },
    }
    const sortObj = sortMap[sort as string] ?? sortMap.recent

    const pageNum = Number(page)
    const limitNum = Number(limit)
    const skip = (pageNum - 1) * limitNum

    const matchFilter: Record<string, unknown> = {
      type: 'tvshow',
      posterUrl: { $ne: '' },
      ...NOT_DAILY_SOAP,
    }

    if (year) matchFilter.releaseYear = Number(year)
    if (language && typeof language === 'string') {
      matchFilter.language = language
    }
    // no default language filter — show all languages
    if (minRating) matchFilter.rating = { $gte: Number(minRating) }

    if (genre && typeof genre === 'string') {
      matchFilter.$and = [
        { genres: { $nin: EXCLUDED_GENRES } },
        { genres: { $regex: genre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      ]
    } else {
      matchFilter.genres = { $nin: EXCLUDED_GENRES }
    }

    // Fetch all matching docs (dedup in memory — dataset is small enough)
    const allDocs = await Movie.find(matchFilter as any)
      .sort(sortObj)
      .select('-sources')
      .lean()

    // Dedup by normalized tmdbId (strip tv_ prefix)
    const seen = new Set<string>()
    const deduped = allDocs.filter(doc => {
      const key = String(doc.tmdbId ?? '').replace(/^tv_/, '')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const total = deduped.length
    const shows = deduped.slice(skip, skip + limitNum)

    res.json({ movies: shows, total, page: pageNum, pages: Math.ceil(total / limitNum) })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/trending', async (_req, res) => {
  try {
    const currentYear = new Date().getFullYear()
    const shows = await Movie.find({
      type:           'tvshow',
      streamVerified: { $ne: false },
      language:       { $in: ['Hindi', 'English'] },
      releaseYear:    { $gte: 2020, $lte: currentYear - 1 },
      rating:         { $gte: 7.5, $lte: 9.5 },
      genres:         { $nin: EXCLUDED_GENRES },
      posterUrl:      { $ne: '' },
      backdropUrl:    { $ne: '' },
      ...NOT_DAILY_SOAP,
    })
      .sort({ rating: -1, releaseYear: -1 })
      .limit(30)
      .select('-sources')
    const seen = new Set<string>()
    const unique = shows.filter(s => {
      const key = s.title.toLowerCase().replace(/[^a-z0-9]/g, '')
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
    // Latest = 2026 shows, any rating ≥ 5, sorted by rating
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
      .sort({ rating: -1, releaseYear: -1 })
      .limit(40)
      .select('-sources')
    const seen = new Set<string>()
    const unique = shows.filter(s => {
      const key = s.title.toLowerCase().replace(/[^a-z0-9]/g, '')
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
    const shows = await Movie.find({
      type:           'tvshow',
      streamVerified: { $ne: false },
      language:       { $in: ['Hindi', 'English', 'Korean', 'Japanese', 'Tamil', 'Telugu'] },
      releaseYear:    { $gte: 2015 },
      rating:         { $gte: 6.5, $lte: 9.5 },
      genres:         { $nin: EXCLUDED_GENRES },
      posterUrl:      { $ne: '' },
      backdropUrl:    { $ne: '' },
      ...NOT_DAILY_SOAP,
    }).sort({ rating: -1, releaseYear: -1 }).limit(60).select('-sources')
    const seen = new Set<string>()
    const unique = shows.filter(s => {
      const key = s.title.toLowerCase().replace(/[^a-z0-9]/g, '')
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
    const shows = await Movie.find({
      type:           'tvshow',
      streamVerified: { $ne: false },
      releaseYear:    { $gte: 2000 },
      rating:         { $gte: 8.0, $lte: 9.5 },
      genres:         { $nin: EXCLUDED_GENRES },
      posterUrl:      { $ne: '' },
      backdropUrl:    { $ne: '' },
      ...NOT_DAILY_SOAP,
    }).sort({ rating: -1, releaseYear: -1 }).limit(60).select('-sources')
    const seen = new Set<string>()
    const unique = shows.filter(s => {
      const key = s.title.toLowerCase().replace(/[^a-z0-9]/g, '')
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
      type:           'tvshow',
      streamVerified: { $ne: false },
      language:       req.params.lang,
      rating:         { $gte: 5, $lte: 9.5 },
      genres:         { $nin: EXCLUDED_GENRES },
      posterUrl:      { $ne: '' },
      backdropUrl:    { $ne: '' },
      ...NOT_DAILY_SOAP,
    })
      .sort({ rating: -1, releaseYear: -1 })
      .limit(300)
      .select('-sources')
    const seen = new Set<string>()
    const shows = raw.filter(s => {
      const key = `${s.title.toLowerCase().replace(/[^a-z0-9]/g, '')}_${s.releaseYear ?? ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    res.json(shows)
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

    const anyTokenFilter = tokens.map(t => {
      const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return { $or: [{ title: { $regex: esc, $options: 'i' } }, { titleHindi: { $regex: esc, $options: 'i' } }] }
    })

    const prefix2 = raw.slice(0, 2).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Only use prefix2 for single-word queries — for multi-word, it floods candidates with
    // irrelevant results (e.g. "The Society" → prefix "Th" brings 100+ "The ..." shows)
    const orClauses: object[] = [
      { $and: anyTokenFilter },
      { title: { $regex: escapedFull, $options: 'i' } },
      { titleHindi: { $regex: escapedFull, $options: 'i' } },
      { synopsis: { $regex: escapedFull, $options: 'i' } },
    ]
    if (tokens.length === 1) {
      orClauses.push({ title: { $regex: `^${prefix2}`, $options: 'i' } })
    }

    const candidates = await Movie.find({
      type: 'tvshow',
      $or: orClauses,
    })
      .limit(150)
      .select('-sources')
      .lean()

    const fuse = new Fuse(candidates, {
      keys: [
        { name: 'title', weight: 2 },
        { name: 'titleHindi', weight: 1.5 },
        { name: 'synopsis', weight: 0.5 },
      ],
      threshold: 0.6,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 2,
    })

    const fuseResults = fuse.search(raw)

    const ranked = fuseResults.length > 0
      ? fuseResults.map(r => r.item)
      : candidates.sort((a, b) => (b as any).rating - (a as any).rating)

    const seenKeys = new Set<string>()
    const deduped = ranked.filter(item => {
      const key = String((item as any).tmdbId ?? '').replace(/^tv_/, '') || String((item as any)._id)
      if (seenKeys.has(key)) return false
      seenKeys.add(key)
      return true
    })

    res.json(deduped.slice(0, 20))
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

    const dedup = (docs: any[]) => {
      const seen = new Set<string>()
      const unique = docs.filter(d => {
        const idKey  = String(d.tmdbId ?? '').replace(/^tv_/, '')
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
        _id:            { $ne: show._id },
        type:           'tvshow',
        genres:         { $in: topGenres },
        language:       { $in: show.language },
        streamVerified: { $ne: false },
        rating:         { $gte: 5 },
        posterUrl:      { $ne: '' },
      }).sort({ rating: -1, releaseYear: -1 }).limit(80).select('-sources').lean(),

      Movie.find({
        _id:            { $ne: show._id },
        type:           'tvshow',
        genres:         { $nin: topGenres },
        language:       { $in: show.language },
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
    const show = await Movie.findOne({ slug: req.params.slug, type: 'tvshow' })
    if (!show) return res.status(404).json({ error: 'Show not found' })
    res.json(show)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

export { router as showsRouter }
