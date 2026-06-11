import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

chromium.use(StealthPlugin() as any)

export interface SVSubtitle {
  label: string
  language: string
  url: string
  default: boolean
}

export interface SVStream {
  url: string
  subtitles: SVSubtitle[]
}

// In-memory cache: key → { stream, cachedAt }
const cache = new Map<string, { stream: SVStream; cachedAt: number }>()
const CACHE_TTL = 6 * 60 * 60 * 1000 // 6 hours

function cacheKey(tmdbId: string, type: string, season?: number, episode?: number) {
  return type === 'movie' ? `movie_${tmdbId}` : `tv_${tmdbId}_s${season}_e${episode}`
}


export async function scrapeStreamVault(
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<SVStream | null> {
  const key = cacheKey(tmdbId, type, season, episode)

  // Return cached result if still fresh
  const cached = cache.get(key)
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached.stream
  }

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
    })
    const page = await context.newPage()

    let streamUrl: string | null = null
    let fallbackUrl: string | null = null

    // Quality-specific playlists to accept as fallback (680p+)
    const HIGH_QUALITY_RE = /\/(680|720|1080|1440|2160|4k)p?\.m3u8/i

    page.on('request', req => {
      const url = req.url()
      if (!url.includes('streamvaultsrc.click/stream-proxy/pl') || !url.includes('.m3u8')) return
      if (url.includes('master.m3u8')) {
        streamUrl = url // master = adaptive quality, prefer this
      } else if (!fallbackUrl && HIGH_QUALITY_RE.test(url)) {
        fallbackUrl = url // 680p+ quality playlist as fallback
      }
    })

    const pageUrl = type === 'movie'
      ? `https://streamvaults.ru/movie/${tmdbId}`
      : `https://streamvaults.ru/tv/${tmdbId}`

    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

    // For TV shows: click the specific episode if not S1E1
    if (type === 'tv' && (season !== 1 || episode !== 1)) {
      try {
        if (season && season > 1) {
          const seasonBtn = page.locator(`text=Season ${season}`).first()
          if (await seasonBtn.isVisible({ timeout: 5000 })) await seasonBtn.click()
        }
        const epBtn = page.locator(`[data-episode="${episode}"], a:has-text("E${episode} ")`).first()
        if (await epBtn.isVisible({ timeout: 5000 })) await epBtn.click()
      } catch { /* best-effort */ }
    }

    // Wait 3s for player to initialise, then try clicking play if stream not found yet
    await page.waitForTimeout(3000)
    if (!streamUrl) {
      try {
        // Click the player area to trigger autoplay
        await page.click('video, .player, [class*="player"], [class*="video"]', { timeout: 3000 })
      } catch { /* no player element found */ }
    }

    // Wait up to 20s — exit as soon as master.m3u8 OR a high-quality fallback appears
    const deadline = Date.now() + 20000
    while (!streamUrl && !fallbackUrl && Date.now() < deadline) {
      await page.waitForTimeout(500)
    }
    const finalUrl = streamUrl ?? fallbackUrl
    if (!finalUrl) return null

    // Subtitles via streamvaultsrc public API (no scraping needed)
    const subUrl = type === 'movie'
      ? `https://streamvaultsrc.click/api/subtitles/movie/${tmdbId}`
      : `https://streamvaultsrc.click/api/subtitles/tv/${tmdbId}/${season}/${episode}`

    const subtitles: SVSubtitle[] = [{ label: 'EN', language: 'en', url: subUrl, default: true }]

    const stream: SVStream = { url: finalUrl, subtitles }
    cache.set(key, { stream, cachedAt: Date.now() })
    return stream

  } catch (err) {
    console.error('[StreamVault] scrape error:', err)
    return null
  } finally {
    await browser?.close()
  }
}
