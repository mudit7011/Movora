import { Router } from 'express'
import { Movie } from '../models/Movie'
import { tmdbFetch } from '../utils/tmdb'
import { cacheSet } from '../utils/boundedCache'
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
      latest: { createdAt: -1, _id: -1 },
      recent: { releaseYear: -1, rating: -1, _id: -1 },
      rating: { rating: -1, _id: -1 },
      year:   { releaseYear: -1, _id: -1 },
    }
    const sortObj = sortMap[sort as string] ?? sortMap.latest

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

    // Cap the candidate pool — sorting the entire collection in memory exceeds
    // MongoDB's 100MB sort limit on large catalogs and crashes the request.
    // 250 candidates = ~12 pages of 20; fetching only card fields (not cast/
    // synopsis/backdrop) cuts per-doc cost massively on free-tier Mongo.
    const allDocs = await Movie.find(matchFilter as any)
      .sort(sortObj)
      .limit(250)
      .select('tmdbId slug title titleHindi posterUrl rating releaseYear type genres language seasons')
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
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    const results = await Movie.aggregate([
      {
        $match: {
          type: 'tvshow',
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
      const key = String(item.tmdbId ?? '').replace(/^tv_/, '') || String(item._id)
      if (seenKeys.has(key)) return false
      seenKeys.add(key)
      return true
    })

    res.json(deduped)
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

const relatedCache = new Map<string, { data: any; ts: number }>()
const RELATED_TTL = 6 * 60 * 60 * 1000 // 6 hours
const RELATED_MAX = 300                 // cap entries so a crawler can't grow it unbounded

router.get('/related/:slug', async (req, res) => {
  try {
    const cached = relatedCache.get(req.params.slug)
    if (cached && Date.now() - cached.ts < RELATED_TTL) return res.json(cached.data)

    const show = await Movie.findOne({ slug: req.params.slug, type: 'tvshow' }).select('_id tmdbId genres language rating')
    if (!show) return res.json({ similar: [], youMayLove: [] })

    const rawId = String(show.tmdbId ?? '').replace(/^tv_/, '')
    const showId = String(show._id)

    // Pick up to 12 unique, poster-having docs; `seen` is shared so the two rows don't overlap.
    const pick = (docs: any[], seen: Set<string>) => {
      const out: any[] = []
      for (const d of docs) {
        const key = String(d?.tmdbId ?? '').replace(/^tv_/, '')
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
      const ids = tmdbItems.map(r => `tv_${r.id}`)
      const existing = await Movie.find({ tmdbId: { $in: ids }, type: 'tvshow' }).select('-sources').lean()
      const byId = new Map(existing.map((m: any) => [String(m.tmdbId).replace(/^tv_/, ''), m]))
      return tmdbItems
        .map(r => byId.get(String(r.id)))
        .filter((d): d is any => !!d && !!d.posterUrl && String(d._id) !== showId)
    }

    let recMatches: any[] = []
    let simMatches: any[] = []
    if (rawId) {
      const [recData, simData] = await Promise.allSettled([
        tmdbFetch(`/tv/${rawId}/recommendations?language=en-US&page=1`),
        tmdbFetch(`/tv/${rawId}/similar?language=en-US&page=1`),
      ])
      recMatches = await dbMatches(recData.status === 'fulfilled' ? (recData.value.results || []) : [])
      simMatches = await dbMatches(simData.status === 'fulfilled' ? (simData.value.results || []) : [])
    }

    // Top up from our DB by genre/language so rows stay full — still no imports.
    const topGenres = show.genres.slice(0, 2)
    const [genrePool, broadPool] = await Promise.all([
      Movie.find({ _id: { $ne: show._id }, type: 'tvshow', genres: { $in: topGenres }, language: { $in: show.language }, streamVerified: { $ne: false }, rating: { $gte: 5 }, posterUrl: { $ne: '' } }).sort({ rating: -1, releaseYear: -1 }).limit(80).select('-sources').lean(),
      Movie.find({ _id: { $ne: show._id }, type: 'tvshow', genres: { $nin: topGenres }, language: { $in: show.language }, streamVerified: { $ne: false }, rating: { $gte: 6.5 }, posterUrl: { $ne: '' } }).sort({ rating: -1, releaseYear: -1 }).limit(80).select('-sources').lean(),
    ])

    const seen = new Set<string>([rawId]) // never include the show itself
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
