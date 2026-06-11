import { Router } from 'express'
import { scrapeStreamVault, clearStreamCache } from '../utils/streamvaultScraper'

export const streamRouter = Router()

// DELETE /api/stream/cache — clear all cached stream URLs
streamRouter.delete('/cache', (_req, res) => {
  clearStreamCache()
  res.json({ ok: true, message: 'Stream cache cleared' })
})

// GET /api/stream?tmdbId=124364&type=tv&season=1&episode=1
// GET /api/stream?tmdbId=552&type=movie&refresh=1  (bypass cache)
streamRouter.get('/', async (req, res) => {
  const { tmdbId, type, season, episode, refresh } = req.query

  if (!tmdbId || !type || (type !== 'movie' && type !== 'tv')) {
    return res.status(400).json({ error: 'tmdbId and type (movie|tv) required' })
  }

  const s = season ? parseInt(season as string) : undefined
  const e = episode ? parseInt(episode as string) : undefined

  if (type === 'tv' && (!s || !e)) {
    return res.status(400).json({ error: 'season and episode required for tv' })
  }

  const force = refresh === '1'

  try {
    const sv = await scrapeStreamVault(tmdbId as string, type as 'movie' | 'tv', s, e, force)
    if (sv) return res.json(sv)

    return res.status(404).json({ error: 'Stream not found' })
  } catch (err) {
    console.error('[stream route]', err)
    res.status(500).json({ error: 'Scrape failed' })
  }
})
