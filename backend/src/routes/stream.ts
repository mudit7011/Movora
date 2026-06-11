import { Router } from 'express'
import { scrapeStreamVault } from '../utils/streamvaultScraper'

export const streamRouter = Router()

// GET /api/stream?tmdbId=124364&type=tv&season=1&episode=1
// GET /api/stream?tmdbId=552&type=movie
streamRouter.get('/', async (req, res) => {
  const { tmdbId, type, season, episode } = req.query

  if (!tmdbId || !type || (type !== 'movie' && type !== 'tv')) {
    return res.status(400).json({ error: 'tmdbId and type (movie|tv) required' })
  }

  const s = season ? parseInt(season as string) : undefined
  const e = episode ? parseInt(episode as string) : undefined

  if (type === 'tv' && (!s || !e)) {
    return res.status(400).json({ error: 'season and episode required for tv' })
  }

  try {
    const stream = await scrapeStreamVault(tmdbId as string, type as 'movie' | 'tv', s, e)
    if (!stream) return res.status(404).json({ error: 'Stream not found' })
    res.json(stream)
  } catch (err) {
    console.error('[stream route]', err)
    res.status(500).json({ error: 'Scrape failed' })
  }
})
