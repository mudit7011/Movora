import { Router } from 'express'

const router = Router()

const OS_API = 'https://api.opensubtitles.com/api/v1'
const API_KEY = process.env.OPENSUBTITLES_API_KEY ?? ''

const osHeaders = {
  'Api-Key': API_KEY,
  'Content-Type': 'application/json',
  'User-Agent': 'Movora v1.0',
}

// GET /api/subtitles/search?tmdbId=xxx&type=movie|tv&season=1&episode=1&languages=en
router.get('/search', async (req, res) => {
  const { tmdbId, type, season, episode, languages } = req.query as Record<string, string>
  if (!tmdbId || !type) return res.status(400).json({ error: 'tmdbId and type required' })
  if (!API_KEY) return res.status(503).json({ error: 'Subtitles service not configured' })

  const params = new URLSearchParams({
    tmdb_id: tmdbId,
    type: type === 'tv' ? 'episode' : 'movie',
    ...(languages ? { languages } : {}),
    ...(season  ? { season_number: season }  : {}),
    ...(episode ? { episode_number: episode } : {}),
    order_by: 'download_count',
    order_direction: 'desc',
  })

  const r = await fetch(`${OS_API}/subtitles?${params}`, { headers: osHeaders }).catch(() => null)
  if (!r?.ok) return res.status(502).json({ error: 'OpenSubtitles search failed' })

  const data = await r.json()
  const results = (data.data ?? []).slice(0, 20).map((item: Record<string, unknown>) => {
    const a = item.attributes as Record<string, unknown>
    const files = (a.files as Record<string, unknown>[])?.[0]
    return {
      fileId:    files?.file_id,
      fileName:  files?.file_name,
      language:  a.language,
      langName:  (a as Record<string, unknown>).language_name ?? a.language,
      downloads: a.download_count,
      rating:    a.ratings,
      release:   a.release,
      hearing:   a.hearing_impaired,
    }
  }).filter((x: Record<string, unknown>) => x.fileId)

  res.json(results)
})

// POST /api/subtitles/download  body: { fileId: number }
router.post('/download', async (req, res) => {
  const { fileId } = req.body as { fileId: number }
  if (!fileId) return res.status(400).json({ error: 'fileId required' })
  if (!API_KEY) return res.status(503).json({ error: 'Subtitles service not configured' })

  const r = await fetch(`${OS_API}/download`, {
    method: 'POST',
    headers: osHeaders,
    body: JSON.stringify({ file_id: fileId }),
  }).catch(() => null)

  if (!r?.ok) return res.status(502).json({ error: 'Download link request failed' })
  const data = await r.json() as { link?: string }
  if (!data.link) return res.status(502).json({ error: 'No download link returned' })

  // Proxy the actual subtitle file so the browser doesn't hit CORS
  const sub = await fetch(data.link).catch(() => null)
  if (!sub?.ok) return res.status(502).json({ error: 'Subtitle file fetch failed' })

  const text = await sub.text()
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=86400')
  res.send(text)
})

export { router as subtitlesRouter }
