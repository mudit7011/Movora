/**
 * Scraper for net22.cc (NetMirror)
 * - Bypasses Cloudflare with playwright-extra stealth
 * - Discovers movie/show titles + any embed server URLs they use
 * - Enriches via TMDB, upserts into MongoDB
 *
 * Run: npx ts-node --transpile-only scripts/scrape-net22.ts
 */
// Use require for untyped playwright-extra packages
/* eslint-disable @typescript-eslint/no-var-requires */
const { chromium } = require('playwright-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
/* eslint-enable */
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })
chromium.use(StealthPlugin())

const TMDB_BEARER = process.env.TMDB_BEARER!
const TMDB_BASE   = 'https://api.themoviedb.org/3'
const IMG_W       = 'https://image.tmdb.org/t/p/w500'
const IMG_O       = 'https://image.tmdb.org/t/p/original'
const IMG_FACE    = 'https://image.tmdb.org/t/p/w185'

// Known public embed providers — we'll ADD any new ones we detect from net22
const KNOWN_MOVIE_SERVERS = (tmdbId: string) => [
  { serverName: 'Server 1', url: `https://player.videasy.net/movie/${tmdbId}`,        type: 'iframe', quality: 'HD', isWorking: true },
  { serverName: 'Server 2', url: `https://www.2embed.cc/embed/${tmdbId}`,              type: 'iframe', quality: 'HD', isWorking: true },
  { serverName: 'Server 3', url: `https://vidsrc.icu/embed/movie/${tmdbId}`,           type: 'iframe', quality: 'HD', isWorking: true },
  { serverName: 'Server 4', url: `https://embed.su/embed/movie/${tmdbId}`,             type: 'iframe', quality: 'HD', isWorking: true },
  { serverName: 'Server 5', url: `https://vidsrc.cc/v2/embed/movie/${tmdbId}`,         type: 'iframe', quality: 'HD', isWorking: true },
  { serverName: 'Server 6', url: `https://vidsrc.to/embed/movie/${tmdbId}`,            type: 'iframe', quality: 'HD', isWorking: true },
  { serverName: 'Server 7', url: `https://autoembed.cc/movie/tmdb/${tmdbId}`,          type: 'iframe', quality: 'HD', isWorking: true },
  { serverName: 'Server 8', url: `https://vidlink.pro/movie/${tmdbId}`,                type: 'iframe', quality: 'HD', isWorking: true },
  { serverName: 'Server 9', url: `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`,  type: 'iframe', quality: 'HD', isWorking: true },
]

const KNOWN_SHOW_SERVERS = (tmdbId: string, season: number, ep: number) => [
  { serverName: 'Server 1', url: `https://player.videasy.net/tv/${tmdbId}/${season}/${ep}`,              type: 'iframe', quality: 'HD', isWorking: true },
  { serverName: 'Server 2', url: `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${ep}`,          type: 'iframe', quality: 'HD', isWorking: true },
  { serverName: 'Server 3', url: `https://vidsrc.icu/embed/tv/${tmdbId}/${season}/${ep}`,                type: 'iframe', quality: 'HD', isWorking: true },
  { serverName: 'Server 4', url: `https://embed.su/embed/tv/${tmdbId}/${season}/${ep}`,                  type: 'iframe', quality: 'HD', isWorking: true },
  { serverName: 'Server 5', url: `https://vidsrc.cc/v2/embed/tv/${tmdbId}/${season}/${ep}`,              type: 'iframe', quality: 'HD', isWorking: true },
  { serverName: 'Server 6', url: `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${ep}`,                 type: 'iframe', quality: 'HD', isWorking: true },
  { serverName: 'Server 7', url: `https://autoembed.cc/tv/tmdb/${tmdbId}-${season}-${ep}`,               type: 'iframe', quality: 'HD', isWorking: true },
  { serverName: 'Server 8', url: `https://vidlink.pro/tv/${tmdbId}/${season}/${ep}`,                     type: 'iframe', quality: 'HD', isWorking: true },
  { serverName: 'Server 9', url: `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${ep}`,type: 'iframe', quality: 'HD', isWorking: true },
]

// Mongoose model (inline to keep script self-contained)
const MovieSchema = new mongoose.Schema({}, { strict: false })
const Movie = mongoose.models.Movie || mongoose.model('Movie', MovieSchema, 'movies')

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function tmdbFetch(path: string) {
  const res = await fetch(`${TMDB_BASE}${path}`, {
    headers: { Authorization: `Bearer ${TMDB_BEARER}`, 'Content-Type': 'application/json' }
  })
  if (!res.ok) return null
  return res.json()
}

async function enrichAndUpsert(title: string, type: 'movie' | 'tv', detectedEmbeds: string[] = []) {
  const query = encodeURIComponent(title)
  const search = await tmdbFetch(`/search/${type}?query=${query}&language=en-US`)
  const result = search?.results?.[0]
  if (!result) { console.log(`  ✗ TMDB not found: ${title}`); return }

  const tmdbId  = String(result.id)
  const detail  = await tmdbFetch(`/${type}/${result.id}?language=en-US&append_to_response=credits`)
  if (!detail)  return

  const isTV    = type === 'tv'
  const docTitle = isTV ? detail.name : detail.title

  const cast = (detail.credits?.cast ?? []).slice(0, 10).map((m: any) => ({
    name: m.name,
    character: m.character,
    photo: m.profile_path ? `${IMG_FACE}${m.profile_path}` : '',
  }))

  // Build servers — start with known ones, prepend any NEW servers detected from site
  const newServers = detectedEmbeds
    .filter(u => !KNOWN_MOVIE_SERVERS(tmdbId).some(s => s.url === u))
    .map((url, i) => ({ serverName: `Detected ${i + 1}`, url, type: 'iframe', quality: 'HD', isWorking: true }))

  const sources = isTV
    ? KNOWN_SHOW_SERVERS(tmdbId, 1, 1)
    : [...newServers, ...KNOWN_MOVIE_SERVERS(tmdbId)]

  const seasonData = isTV
    ? (detail.seasons ?? [])
        .filter((s: any) => s.season_number > 0)
        .map((s: any) => ({ seasonNumber: s.season_number, name: s.name, episodeCount: s.episode_count }))
    : []

  const doc = {
    title: docTitle,
    tmdbId,
    type: isTV ? 'tvshow' : 'movie',
    genres: (detail.genres ?? []).map((g: any) => g.name),
    language: [detail.original_language === 'hi' ? 'Hindi' : 'English'],
    releaseYear: parseInt((isTV ? detail.first_air_date : detail.release_date)?.slice(0, 4) ?? '0'),
    rating: result.vote_average ?? 0,
    synopsis: detail.overview ?? '',
    posterUrl: detail.poster_path ? `${IMG_W}${detail.poster_path}` : '',
    backdropUrl: detail.backdrop_path ? `${IMG_O}${detail.backdrop_path}` : '',
    cast,
    sources,
    seasons: isTV ? detail.number_of_seasons : undefined,
    seasonData: isTV ? seasonData : undefined,
    slug: docTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + (isTV ? detail.first_air_date : detail.release_date)?.slice(0, 4),
  }

  await Movie.updateOne({ tmdbId }, { $set: doc }, { upsert: true })
  console.log(`  ✓ ${isTV ? 'TV' : 'Movie'}: ${docTitle} (${tmdbId}) — ${sources.length} servers`)
}

// ─── DETECT embed servers from a live page ─────────────────────────────────

async function detectEmbedServers(page: any, url: string): Promise<string[]> {
  const found: string[] = []
  page.on('request', (req: any) => {
    const u = req.url()
    // Look for iframe/embed URL patterns from video providers
    if (/\/(embed|player|watch|stream)\//i.test(u) && !/cloudflare|google|tmdb|facebook/i.test(u)) {
      found.push(u)
    }
  })
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await sleep(3000)
    // Also grab iframe src attributes directly from DOM
    const iframeSrcs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('iframe[src]')).map((el: any) => el.src)
    )
    found.push(...iframeSrcs)
  } catch { /* timeout ok */ }
  const unique = [...new Set(found)].filter(u => u.startsWith('http'))
  if (unique.length) console.log(`  🔍 Detected embed servers: ${unique.join(', ')}`)
  return unique
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!)
  console.log('✅ MongoDB connected')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  })
  const page = await context.newPage()

  const BASE = 'https://net22.cc'

  // ─── Step 1: Discover site structure from homepage ────────────────────────
  console.log('\n🔍 Step 1: Loading net22.cc homepage to discover structure...')
  await page.goto(`${BASE}/home`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await sleep(3000)

  // Find first content link to use for embed detection
  const firstContentUrl: string = await page.evaluate((base: string) => {
    const links = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[]
    const content = links.find(a =>
      a.href.includes('/watch/') || a.href.includes('/movie/') ||
      a.href.includes('/detail/') || a.href.includes('/film/')
    )
    return content?.href || `${base}/home`
  }, BASE)

  console.log(`  First content URL: ${firstContentUrl}`)

  // ─── Step 2: Detect embed servers ─────────────────────────────────────────
  console.log('\n🎯 Step 2: Detecting embed servers...')
  const detectedEmbeds = await detectEmbedServers(page, firstContentUrl)
  console.log(`  Found ${detectedEmbeds.length} embed sources`)

  // ─── Step 3: Discover listing pages ───────────────────────────────────────
  console.log('\n🗺  Step 3: Discovering movie/show listing pages...')
  await page.goto(`${BASE}/home`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await sleep(2000)

  // Find all unique section/listing hrefs from nav + homepage
  const listingUrls: { url: string; type: 'movie' | 'tv' }[] = await page.evaluate((base: string) => {
    const links = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[]
    const results: { url: string; type: 'movie' | 'tv' }[] = []
    links.forEach(a => {
      const h = a.href
      if (/movie/i.test(h) && !h.includes('/watch/') && !results.find(r => r.url === h))
        results.push({ url: h, type: 'movie' })
      if (/(tv|series|show)/i.test(h) && !h.includes('/watch/') && !results.find(r => r.url === h))
        results.push({ url: h, type: 'tv' })
    })
    return results.slice(0, 10) // limit to first 10 listing pages found
  }, BASE)

  // Fallback listing URLs if none auto-detected
  if (listingUrls.length === 0) {
    listingUrls.push(
      { url: `${BASE}/movies`, type: 'movie' },
      { url: `${BASE}/tv-series`, type: 'tv' },
      { url: `${BASE}/genre/hindi`, type: 'movie' },
      { url: `${BASE}/genre/bollywood`, type: 'movie' },
    )
  }
  console.log(`  Found ${listingUrls.length} listing pages`)

  // ─── Step 4: Scrape content titles from listing pages ─────────────────────
  const movieTitles: string[] = []
  const showTitles: string[] = []

  console.log('\n🎬 Step 4: Collecting titles...')
  for (const { url: catUrl, type } of listingUrls) {
    for (let p = 1; p <= 8; p++) {
      const url = p === 1 ? catUrl : `${catUrl}?page=${p}`
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
        await sleep(1500)
        const titles: string[] = await page.evaluate(() => {
          // Generic selectors covering most streaming site card layouts
          const selectors = [
            '.film-name', '.film-title', '.movie-title', '.title',
            '.name', 'h2 a', 'h3 a', '.card-title',
            '[class*="title"] a', '[class*="name"] a',
            'a[class*="title"]', 'a[class*="name"]',
          ]
          const found = new Set<string>()
          selectors.forEach(sel => {
            document.querySelectorAll(sel).forEach((el: any) => {
              const t = el.textContent?.trim()
              if (t && t.length > 1 && t.length < 100) found.add(t)
            })
          })
          return [...found]
        })
        if (titles.length === 0) break // no more pages
        if (type === 'movie') movieTitles.push(...titles)
        else showTitles.push(...titles)
        console.log(`  [${type}] ${url} → ${titles.length} titles`)
      } catch { console.log(`  ✗ Failed: ${url}`); break }
      await sleep(800)
    }
  }

  await browser.close()

  // Deduplicate
  const uniqueMovies = [...new Set(movieTitles)].filter(t => t.length > 1)
  const uniqueShows  = [...new Set(showTitles)].filter(t => t.length > 1)
  console.log(`\n📊 Unique movies: ${uniqueMovies.length}, TV shows: ${uniqueShows.length}`)

  // ─── Enrich & upsert ─────────────────────────────────────────────────────
  console.log('\n⬆️  Step 4: Enriching with TMDB and upserting...')
  for (const title of uniqueMovies) {
    await enrichAndUpsert(title, 'movie', detectedEmbeds)
    await sleep(300)
  }
  for (const title of uniqueShows) {
    await enrichAndUpsert(title, 'tv', detectedEmbeds)
    await sleep(300)
  }

  await mongoose.disconnect()
  console.log('\n✅ Done!')
}

main().catch(console.error)
