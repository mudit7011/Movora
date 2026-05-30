import { Router } from 'express'
import { ScrapeJob } from '../../models/ScrapeJob'
import { Movie } from '../../models/Movie'
import { tmdbFetch } from '../../utils/tmdb'
import { authenticate } from '../../middleware/authenticate'

const router = Router()
router.use(authenticate)

const IMG_W    = 'https://image.tmdb.org/t/p/w500'
const IMG_O    = 'https://image.tmdb.org/t/p/original'
const IMG_FACE = 'https://image.tmdb.org/t/p/w185'
const LANG_MAP: Record<string, string> = {
  en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu',
  ml: 'Malayalam', ko: 'Korean', ja: 'Japanese', fr: 'French',
  es: 'Spanish', de: 'German', zh: 'Chinese', it: 'Italian',
}

function slugify(title: string, year: number) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + year
}

type ImportResult = { status: 'added' | 'skipped' | 'error'; title?: string }

// Fetch and insert a single movie by TMDB id
async function importMovie(id: number): Promise<ImportResult> {
  try {
    const exists = await Movie.exists({ tmdbId: String(id) })
    if (exists) return { status: 'skipped' }
    const [detail, credits, videos] = await Promise.all([
      tmdbFetch(`/movie/${id}?language=en-US`),
      tmdbFetch(`/movie/${id}/credits?language=en-US`),
      tmdbFetch(`/movie/${id}/videos?language=en-US`),
    ])
    if (!detail?.title) return { status: 'error' }
    const year    = parseInt((detail.release_date || '0').slice(0, 4)) || 0
    const trailer = (videos.results || []).find((v: any) => v.type === 'Trailer' && v.site === 'YouTube')
    const cast    = (credits.cast || []).slice(0, 15).map((c: any) => ({
      name: c.name, character: c.character || '',
      photo: c.profile_path ? `${IMG_FACE}${c.profile_path}` : undefined,
    }))
    const title = detail.title
    await Movie.create({
      tmdbId:    String(id),
      type:      'movie',
      title,
      slug:      slugify(detail.title, year),
      language:  [LANG_MAP[detail.original_language] || detail.original_language || 'English'],
      genres:    (detail.genres || []).map((g: any) => g.name),
      releaseYear: year,
      rating:    Math.round((detail.vote_average || 0) * 10) / 10,
      runtime:   detail.runtime || 0,
      synopsis:  detail.overview || '',
      posterUrl:   detail.poster_path   ? `${IMG_W}${detail.poster_path}`   : '',
      backdropUrl: detail.backdrop_path ? `${IMG_O}${detail.backdrop_path}` : '',
      trailerKey:  trailer?.key,
      cast,
      sources: [
        { serverName: 'Server 1', url: `https://player.videasy.net/movie/${id}?color=06D6E0&autoplay=1&overlay=true`, type: 'iframe', quality: 'HD', isWorking: true },
        { serverName: 'Server 2', url: `https://vidlink.pro/movie/${id}?primaryColor=06D6E0&autoplay=true`, type: 'iframe', quality: 'HD', isWorking: true },
        { serverName: 'Server 3', url: `https://embedmaster.link/fljq7ku6ysokw3og/movie/${id}`, type: 'iframe', quality: 'HD', isWorking: true },
        { serverName: 'Server 4', url: `https://streamvaultsrc.click/embed/movie/${id}?autoplay=true&color=%2306D6E0`, type: 'iframe', quality: 'HD', isWorking: true },
      ],
      streamVerified: true,
      scrapedFrom: 'admin-fetch',
    })
    return { status: 'added', title }
  } catch (e: any) {
    if (e?.code === 11000) return { status: 'skipped' }
    return { status: 'error' }
  }
}

// Fetch and insert a single TV show by TMDB id
async function importShow(id: number): Promise<ImportResult> {
  try {
    const exists = await Movie.exists({ tmdbId: `tv_${id}` })
    if (exists) return { status: 'skipped' }
    const [detail, credits, videos] = await Promise.all([
      tmdbFetch(`/tv/${id}?language=en-US`),
      tmdbFetch(`/tv/${id}/credits?language=en-US`),
      tmdbFetch(`/tv/${id}/videos?language=en-US`),
    ])
    if (!detail?.name) return { status: 'error' }
    const year    = parseInt((detail.first_air_date || '0').slice(0, 4)) || 0
    const trailer = (videos.results || []).find((v: any) => v.type === 'Trailer' && v.site === 'YouTube')
    const cast    = (credits.cast || []).slice(0, 15).map((c: any) => ({
      name: c.name, character: c.character || '',
      photo: c.profile_path ? `${IMG_FACE}${c.profile_path}` : undefined,
    }))
    const validSeasons = (detail.seasons || []).filter((s: any) => s.season_number > 0)
    const title = detail.name
    await Movie.create({
      tmdbId:    `tv_${id}`,
      type:      'tvshow',
      title,
      slug:      slugify(detail.name, year),
      language:  [LANG_MAP[detail.original_language] || detail.original_language || 'English'],
      genres:    (detail.genres || []).map((g: any) => g.name),
      releaseYear: year,
      rating:    Math.round((detail.vote_average || 0) * 10) / 10,
      runtime:   detail.episode_run_time?.[0] || 0,
      synopsis:  detail.overview || '',
      posterUrl:   detail.poster_path   ? `${IMG_W}${detail.poster_path}`   : '',
      backdropUrl: detail.backdrop_path ? `${IMG_O}${detail.backdrop_path}` : '',
      trailerKey:  trailer?.key,
      cast,
      sources: [
        { serverName: 'Server 1', url: `https://player.videasy.net/tv/${id}/1/1?color=06D6E0&autoplay=1&nextEpisode=true&episodeSelector=true&overlay=true`, type: 'iframe', quality: 'HD', isWorking: true },
        { serverName: 'Server 2', url: `https://vidlink.pro/tv/${id}/1/1?primaryColor=06D6E0&autoplay=true&nextbutton=true`, type: 'iframe', quality: 'HD', isWorking: true },
        { serverName: 'Server 3', url: `https://embedmaster.link/fljq7ku6ysokw3og/tv/${id}/1/1`, type: 'iframe', quality: 'HD', isWorking: true },
        { serverName: 'Server 4', url: `https://streamvaultsrc.click/embed/tv/${id}/1/1?autoplay=true&color=%2306D6E0`, type: 'iframe', quality: 'HD', isWorking: true },
      ],
      streamVerified: true,
      scrapedFrom: 'admin-fetch',
      seasons:       validSeasons.length,
      totalEpisodes: detail.number_of_episodes || 0,
      status:        detail.status || '',
      seasonData:    validSeasons.map((s: any) => ({ seasonNumber: s.season_number, episodeCount: s.episode_count, name: s.name })),
    })
    return { status: 'added', title }
  } catch (e: any) {
    if (e?.code === 11000) return { status: 'skipped' }
    return { status: 'error' }
  }
}

const FETCH_ACTIONS: Record<string, { label: string; endpoint: string; mediaType: 'movie' | 'tv' }> = {
  'trending-movies':  { label: 'Trending Movies (Week)',  endpoint: '/trending/movie/week?language=en-US',                             mediaType: 'movie' },
  'popular-movies':   { label: 'Popular Movies',          endpoint: '/movie/popular?language=en-US&page=1',                            mediaType: 'movie' },
  'top-rated-movies': { label: 'Top Rated Movies',        endpoint: '/movie/top_rated?language=en-US&page=1',                          mediaType: 'movie' },
  'upcoming-movies':  { label: 'Upcoming Movies',         endpoint: '/movie/upcoming?language=en-US&page=1',                           mediaType: 'movie' },
  'now-playing':      { label: 'Now Playing Movies',      endpoint: '/movie/now_playing?language=en-US&page=1',                        mediaType: 'movie' },
  'trending-shows':   { label: 'Trending Shows (Week)',   endpoint: '/trending/tv/week?language=en-US',                                mediaType: 'tv'    },
  'popular-shows':    { label: 'Popular Shows',           endpoint: '/tv/popular?language=en-US&page=1',                               mediaType: 'tv'    },
  'top-rated-shows':  { label: 'Top Rated Shows',         endpoint: '/tv/top_rated?language=en-US&page=1',                             mediaType: 'tv'    },
  'airing-today':     { label: 'Airing Today Shows',      endpoint: '/tv/airing_today?language=en-US&page=1',                          mediaType: 'tv'    },
  'hindi-movies':     { label: 'Hindi Movies',            endpoint: '/discover/movie?with_original_language=hi&sort_by=popularity.desc&page=1', mediaType: 'movie' },
  'hindi-shows':      { label: 'Hindi Shows',             endpoint: '/discover/tv?with_original_language=hi&sort_by=popularity.desc&page=1',    mediaType: 'tv'    },
  'korean-shows':     { label: 'Korean Shows',            endpoint: '/discover/tv?with_original_language=ko&sort_by=popularity.desc&page=1',    mediaType: 'tv'    },
  'korean-dramas':    { label: 'Korean Dramas',           endpoint: '/discover/tv?with_original_language=ko&with_genres=18&sort_by=popularity.desc&page=1',    mediaType: 'tv'    },
  'japanese-shows':   { label: 'Japanese Shows',          endpoint: '/discover/tv?with_original_language=ja&sort_by=popularity.desc&page=1',                  mediaType: 'tv'    },
  'japanese-anime':   { label: 'Japanese Anime',          endpoint: '/discover/tv?with_original_language=ja&with_genres=16&sort_by=popularity.desc&page=1',    mediaType: 'tv'    },
  'korean-movies':    { label: 'Korean Movies',           endpoint: '/discover/movie?with_original_language=ko&sort_by=popularity.desc&page=1',               mediaType: 'movie' },
  'japanese-movies':  { label: 'Japanese Movies',         endpoint: '/discover/movie?with_original_language=ja&sort_by=popularity.desc&page=1',               mediaType: 'movie' },
}

// Run a fetch action — fetches multiple TMDB pages (default 3, max 5)
router.post('/fetch/:action', async (req, res) => {
  const action = FETCH_ACTIONS[req.params.action]
  if (!action) { res.status(400).json({ error: 'Unknown action' }); return }

  const pageCount = Math.min(Math.max(Number(req.query.pages ?? 3), 1), 5)
  const job = await ScrapeJob.create({ site: req.params.action, label: action.label, status: 'running', startedAt: new Date() })

  try {
    let added = 0, skipped = 0, errors = 0
    const addedTitles: string[] = []

    for (let p = 1; p <= pageCount; p++) {
      const endpoint = action.endpoint.replace(/page=\d+/, `page=${p}`)
      const data = await tmdbFetch(endpoint)
      const results: any[] = data.results || []
      if (results.length === 0) break

      for (const item of results) {
        const result = action.mediaType === 'movie' ? await importMovie(item.id) : await importShow(item.id)
        if (result.status === 'added')   { added++; if (result.title) addedTitles.push(result.title) }
        if (result.status === 'skipped') skipped++
        if (result.status === 'error')   errors++
      }
    }

    await ScrapeJob.findByIdAndUpdate(job._id, {
      status: 'completed', added, skipped, addedTitles,
      scrapeErrors: errors > 0 ? [`${errors} items failed`] : [],
      completedAt: new Date(),
    })

    res.json({ jobId: job._id, label: action.label, added, skipped, errors, addedTitles })
  } catch (e: any) {
    await ScrapeJob.findByIdAndUpdate(job._id, {
      status: 'failed', scrapeErrors: [e.message], completedAt: new Date(),
    })
    res.status(500).json({ error: e.message })
  }
})

router.get('/actions', (_req, res) => {
  res.json(Object.entries(FETCH_ACTIONS).map(([key, v]) => ({ key, label: v.label, mediaType: v.mediaType })))
})

router.get('/jobs', async (_req, res) => {
  try {
    const jobs = await ScrapeJob.find().sort({ startedAt: -1 }).limit(30)
    res.json(jobs)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

// Legacy trigger (kept for compatibility)
router.post('/trigger', async (_req, res) => {
  res.status(400).json({ error: 'Use /fetch/:action instead', actions: Object.keys(FETCH_ACTIONS) })
})

export { router as adminScrapeRouter }
