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
const StealthPlugin = require('playwright-extra-plugin-stealth')
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

  console.log('\n🔍 Step 1: Detecting embed servers from net22.cc...')
  // Visit one sample movie page to detect embed provider URLs
  const sampleMovie = 'https://net22.cc/movie/top-gun-maverick'
  const detectedEmbeds = await detectEmbedServers(page, sampleMovie)
  console.log(`Found ${detectedEmbeds.length} embed sources`)

  // ─── Scrape Movie listings ────────────────────────────────────────────────
  const movieTitles: string[] = []
  const movieCategories = [
    'https://net22.cc/genre/hindi',
    'https://net22.cc/genre/bollywood',
    'https://net22.cc/genre/hollywood',
    'https://net22.cc/movies',
  ]

  console.log('\n🎬 Step 2: Collecting movie titles...')
  for (const catUrl of movieCategories) {
    for (let p = 1; p <= 5; p++) {
      const url = p === 1 ? catUrl : `${catUrl}?page=${p}`
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
        await sleep(1500)
        const titles = await page.evaluate(() => {
          const cards = document.querySelectorAll('a[href*="/movie/"], .film-name, .film-title, h2 a, .name')
          return Array.from(cards).map((el: any) => el.textContent?.trim()).filter(Boolean)
        })
        movieTitles.push(...(titles as string[]))
        console.log(`  ${url} → ${titles.length} titles`)
      } catch { console.log(`  ✗ Failed: ${url}`) }
      await sleep(1000)
    }
  }

  // ─── Scrape TV Show listings ──────────────────────────────────────────────
  const showTitles: string[] = []
  const showCategories = [
    'https://net22.cc/tv-shows',
    'https://net22.cc/genre/hindi-series',
  ]

  console.log('\n📺 Step 3: Collecting TV show titles...')
  for (const catUrl of showCategories) {
    for (let p = 1; p <= 5; p++) {
      const url = p === 1 ? catUrl : `${catUrl}?page=${p}`
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
        await sleep(1500)
        const titles = await page.evaluate(() => {
          const cards = document.querySelectorAll('a[href*="/tv/"], a[href*="/show/"], .film-name, .film-title, h2 a')
          return Array.from(cards).map((el: any) => el.textContent?.trim()).filter(Boolean)
        })
        showTitles.push(...(titles as string[]))
        console.log(`  ${url} → ${titles.length} titles`)
      } catch { console.log(`  ✗ Failed: ${url}`) }
      await sleep(1000)
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
