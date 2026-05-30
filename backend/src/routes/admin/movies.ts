import { Router } from 'express'
import { z } from 'zod'
import mongoose from 'mongoose'
import { Movie } from '../../models/Movie'
import { BlockedContent } from '../../models/BlockedContent'
import { authenticate } from '../../middleware/authenticate'
import { tmdbFetch } from '../../utils/tmdb'
import { clearRealtimeCache } from '../realtime'

const IMG_W    = 'https://image.tmdb.org/t/p/w500'
const IMG_O    = 'https://image.tmdb.org/t/p/original'
const IMG_FACE = 'https://image.tmdb.org/t/p/w185'

function slugify(title: string, year: number) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + year
}

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
    const page   = Math.max(1, parseInt(req.query.page  as string) || 1)
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 30))
    const search = ((req.query.search as string) || '').trim()

    if (!search) {
      const [movies, total] = await Promise.all([
        Movie.find({})
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .select('title slug type language releaseYear rating sources posterUrl tmdbId'),
        Movie.countDocuments({}),
      ])
      res.json({ movies, total, page, pages: Math.ceil(total / limit) })
      return
    }

    // Relevance-sorted search: exact title > starts-with > contains > slug match
    const esc = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const agg = await Movie.aggregate([
      {
        $match: {
          $or: [
            { title: { $regex: esc, $options: 'i' } },
            { slug:  { $regex: esc, $options: 'i' } },
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
              ],
              default: 3,
            },
          },
        },
      },
      { $sort: { _rel: 1, rating: -1 } },
      {
        $facet: {
          data: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            { $project: { title: 1, slug: 1, type: 1, language: 1, releaseYear: 1, rating: 1, sources: 1, posterUrl: 1, tmdbId: 1 } },
          ],
          count: [{ $count: 'total' }],
        },
      },
    ])

    const movies = agg[0]?.data ?? []
    const total  = agg[0]?.count[0]?.total ?? 0
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
    // Block this tmdbId so realtime importer never re-adds it
    if (movie.tmdbId) {
      await BlockedContent.updateOne({ tmdbId: movie.tmdbId }, { tmdbId: movie.tmdbId }, { upsert: true })
    }
    // Clear realtime cache so deleted item disappears immediately
    clearRealtimeCache()
    res.json({ message: 'Deleted' })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// Find duplicates — groups by tmdbId OR title+releaseYear
router.get('/duplicates', async (req, res) => {
  try {
    // Group by tmdbId — definitive duplicates
    const byTmdbId = await Movie.aggregate([
      { $group: {
        _id: '$tmdbId',
        count: { $sum: 1 },
        docs: { $push: { _id: '$_id', title: '$title', slug: '$slug', type: '$type', releaseYear: '$releaseYear', posterUrl: '$posterUrl', createdAt: '$createdAt', sources: '$sources' } },
      }},
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 100 },
    ])

    // Group by normalised title + year — catches same-content with different tmdbIds
    const byTitleYear = await Movie.aggregate([
      { $group: {
        _id: { title: { $toLower: '$title' }, year: '$releaseYear' },
        count: { $sum: 1 },
        docs: { $push: { _id: '$_id', title: '$title', slug: '$slug', type: '$type', releaseYear: '$releaseYear', posterUrl: '$posterUrl', tmdbId: '$tmdbId', createdAt: '$createdAt', sources: '$sources' } },
      }},
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 100 },
    ])

    res.json({
      byTmdbId: byTmdbId.map(g => ({ tmdbId: g._id, count: g.count, items: g.docs })),
      byTitleYear: byTitleYear.map(g => ({ title: g._id.title, year: g._id.year, count: g.count, items: g.docs })),
      total: byTmdbId.length + byTitleYear.length,
    })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// Bulk delete all duplicate extras — keeps the "best" entry per group
router.post('/delete-duplicates', async (req, res) => {
  try {
    const toDelete: mongoose.Types.ObjectId[] = []

    // --- byTmdbId: same tmdbId, multiple docs ---
    const tmdbGroups = await Movie.aggregate([
      { $group: { _id: '$tmdbId', count: { $sum: 1 }, docs: { $push: { _id: '$_id', sources: '$sources', createdAt: '$createdAt' } } } },
      { $match: { count: { $gt: 1 } } },
    ])
    for (const g of tmdbGroups) {
      // Keep doc with most sources; tie-break: oldest _id
      const sorted = g.docs.slice().sort((a: any, b: any) => {
        const diff = (b.sources?.length ?? 0) - (a.sources?.length ?? 0)
        return diff !== 0 ? diff : (a._id < b._id ? -1 : 1)
      })
      sorted.slice(1).forEach((d: any) => toDelete.push(d._id))
    }

    // --- byTitleYear: same title (case-insensitive) + year, different tmdbIds ---
    const titleGroups = await Movie.aggregate([
      { $group: {
        _id: { title: { $toLower: '$title' }, year: '$releaseYear' },
        count: { $sum: 1 },
        docs: { $push: { _id: '$_id', tmdbId: '$tmdbId', sources: '$sources', createdAt: '$createdAt' } },
      }},
      { $match: { count: { $gt: 1 } } },
    ])
    for (const g of titleGroups) {
      // Prefer tv_-prefixed tmdbId (canonical show format), then most sources, then oldest _id
      const sorted = g.docs.slice().sort((a: any, b: any) => {
        const aCanon = String(a.tmdbId).startsWith('tv_') ? 0 : 1
        const bCanon = String(b.tmdbId).startsWith('tv_') ? 0 : 1
        if (aCanon !== bCanon) return aCanon - bCanon
        const diff = (b.sources?.length ?? 0) - (a.sources?.length ?? 0)
        return diff !== 0 ? diff : (a._id < b._id ? -1 : 1)
      })
      // Only delete extras not already queued (avoid double-deleting)
      sorted.slice(1).forEach((d: any) => {
        if (!toDelete.some(id => id.equals(d._id))) toDelete.push(d._id)
      })
    }

    if (toDelete.length === 0) {
      res.json({ deleted: 0, message: 'No duplicates found' })
      return
    }

    const result = await Movie.deleteMany({ _id: { $in: toDelete } })
    res.json({ deleted: result.deletedCount, message: `Deleted ${result.deletedCount} duplicates` })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// TMDB search — returns lightweight results for the picker
router.get('/tmdb-search', async (req, res) => {
  const q    = ((req.query.q    as string) || '').trim()
  const type = (req.query.type  as string) === 'tv' ? 'tv' : 'movie'
  if (!q) { res.status(400).json({ error: 'q is required' }); return }
  try {
    const endpoint = type === 'tv'
      ? `/search/tv?query=${encodeURIComponent(q)}&language=en-US&page=1`
      : `/search/movie?query=${encodeURIComponent(q)}&language=en-US&page=1`
    const data = await tmdbFetch(endpoint)
    const results = (data.results || []).slice(0, 10).map((r: any) => ({
      id:       r.id,
      title:    r.title || r.name,
      year:     parseInt((r.release_date || r.first_air_date || '0').slice(0, 4)) || 0,
      poster:   r.poster_path ? `${IMG_W}${r.poster_path}` : null,
      rating:   r.vote_average || 0,
      overview: r.overview || '',
    }))
    res.json(results)
  } catch (e: any) {
    res.status(502).json({ error: e.message || 'TMDB error' })
  }
})

// TMDB import — fetches full metadata and upserts into DB
router.post('/tmdb-import', async (req, res) => {
  const { tmdbId, type } = req.body
  if (!tmdbId || !['movie', 'tv'].includes(type)) {
    res.status(400).json({ error: 'tmdbId and type (movie|tv) required' }); return
  }
  const id = String(tmdbId)
  try {
    const storedId = type === 'tv' ? `tv_${id}` : id
    const existing = await Movie.findOne({ tmdbId: storedId })
    if (existing) {
      res.status(409).json({ error: 'Already in database', slug: existing.slug, title: existing.title }); return
    }

    if (type === 'movie') {
      const [detail, credits, videos] = await Promise.all([
        tmdbFetch(`/movie/${id}?language=en-US`),
        tmdbFetch(`/movie/${id}/credits?language=en-US`),
        tmdbFetch(`/movie/${id}/videos?language=en-US`),
      ])
      const year     = parseInt((detail.release_date || '0').slice(0, 4)) || 0
      const trailer  = (videos.results || []).find((v: any) => v.type === 'Trailer' && v.site === 'YouTube')
      const langMap: Record<string, string> = { en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam', ko: 'Korean', ja: 'Japanese', fr: 'French', es: 'Spanish', de: 'German', zh: 'Chinese', it: 'Italian' }
      const langLabel = langMap[detail.original_language] || detail.original_language || 'English'
      const cast = (credits.cast || []).slice(0, 15).map((c: any) => ({
        name:      c.name,
        character: c.character || '',
        photo:     c.profile_path ? `${IMG_FACE}${c.profile_path}` : undefined,
      }))
      const doc = {
        tmdbId:     id,
        type:       'movie' as const,
        title:      detail.title,
        slug:       slugify(detail.title, year),
        language:   [langLabel],
        genres:     (detail.genres || []).map((g: any) => g.name),
        releaseYear: year,
        rating:     Math.round((detail.vote_average || 0) * 10) / 10,
        runtime:    detail.runtime || 0,
        synopsis:   detail.overview || '',
        posterUrl:  detail.poster_path   ? `${IMG_W}${detail.poster_path}`   : '',
        backdropUrl: detail.backdrop_path ? `${IMG_O}${detail.backdrop_path}` : '',
        trailerKey: trailer?.key,
        cast,
        sources: [
          { serverName: 'Server 1', url: `https://player.videasy.net/movie/${id}?color=06D6E0&autoplay=1&overlay=true`, type: 'iframe' as const, quality: 'HD', isWorking: true },
          { serverName: 'Server 2', url: `https://vidlink.pro/movie/${id}?primaryColor=06D6E0&autoplay=true`, type: 'iframe' as const, quality: 'HD', isWorking: true },
          { serverName: 'Server 3', url: `https://embedmaster.link/fljq7ku6ysokw3og/movie/${id}`, type: 'iframe' as const, quality: 'HD', isWorking: true },
          { serverName: 'Server 4', url: `https://streamvaultsrc.click/embed/movie/${id}?autoplay=true&color=%2306D6E0`, type: 'iframe' as const, quality: 'HD', isWorking: true },
        ],
        streamVerified: true,
        scrapedFrom: 'admin-import',
      }
      const movie = await Movie.create(doc)
      res.status(201).json({ message: 'Imported', slug: movie.slug, title: movie.title, type: 'movie' })

    } else {
      const [detail, credits, videos] = await Promise.all([
        tmdbFetch(`/tv/${id}?language=en-US`),
        tmdbFetch(`/tv/${id}/credits?language=en-US`),
        tmdbFetch(`/tv/${id}/videos?language=en-US`),
      ])
      const year    = parseInt((detail.first_air_date || '0').slice(0, 4)) || 0
      const trailer = (videos.results || []).find((v: any) => v.type === 'Trailer' && v.site === 'YouTube')
      const langMap: Record<string, string> = { en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam', ko: 'Korean', ja: 'Japanese', fr: 'French', es: 'Spanish', de: 'German', zh: 'Chinese', it: 'Italian' }
      const langLabel = langMap[detail.original_language] || detail.original_language || 'English'
      const cast = (credits.cast || []).slice(0, 15).map((c: any) => ({
        name:      c.name,
        character: c.character || '',
        photo:     c.profile_path ? `${IMG_FACE}${c.profile_path}` : undefined,
      }))
      const validSeasons = (detail.seasons || []).filter((s: any) => s.season_number > 0)
      const doc = {
        tmdbId:        `tv_${id}`,
        type:          'tvshow' as const,
        title:         detail.name,
        slug:          slugify(detail.name, year),
        language:      [langLabel],
        genres:        (detail.genres || []).map((g: any) => g.name),
        releaseYear:   year,
        rating:        Math.round((detail.vote_average || 0) * 10) / 10,
        runtime:       detail.episode_run_time?.[0] || 0,
        synopsis:      detail.overview || '',
        posterUrl:     detail.poster_path   ? `${IMG_W}${detail.poster_path}`   : '',
        backdropUrl:   detail.backdrop_path ? `${IMG_O}${detail.backdrop_path}` : '',
        trailerKey:    trailer?.key,
        cast,
        sources: [
          { serverName: 'Server 1', url: `https://player.videasy.net/tv/${id}/1/1?color=06D6E0&autoplay=1&nextEpisode=true&episodeSelector=true&overlay=true`, type: 'iframe' as const, quality: 'HD', isWorking: true },
          { serverName: 'Server 2', url: `https://vidlink.pro/tv/${id}/1/1?primaryColor=06D6E0&autoplay=true&nextbutton=true`, type: 'iframe' as const, quality: 'HD', isWorking: true },
          { serverName: 'Server 3', url: `https://embedmaster.link/fljq7ku6ysokw3og/tv/${id}/1/1`, type: 'iframe' as const, quality: 'HD', isWorking: true },
          { serverName: 'Server 4', url: `https://streamvaultsrc.click/embed/tv/${id}/1/1?autoplay=true&color=%2306D6E0`, type: 'iframe' as const, quality: 'HD', isWorking: true },
        ],
        streamVerified: true,
        scrapedFrom:   'admin-import',
        seasons:       validSeasons.length,
        totalEpisodes: (detail.number_of_episodes || 0),
        status:        detail.status || '',
        seasonData:    validSeasons.map((s: any) => ({
          seasonNumber: s.season_number,
          episodeCount: s.episode_count,
          name:         s.name,
        })),
      }
      const show = await Movie.create(doc)
      res.status(201).json({ message: 'Imported', slug: show.slug, title: show.title, type: 'tvshow' })
    }
  } catch (e: any) {
    if (e.code === 11000) {
      res.status(409).json({ error: 'Already in database (duplicate slug or tmdbId)' }); return
    }
    res.status(500).json({ error: e.message || 'Server error' })
  }
})

export { router as adminMoviesRouter }
