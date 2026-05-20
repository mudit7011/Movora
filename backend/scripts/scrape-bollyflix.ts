/**
 * Scrapes movie titles from bollyflix.gd, enriches via TMDB + OMDB,
 * and upserts into MongoDB with our standard embed servers.
 *
 * Run: npx ts-node scripts/scrape-bollyflix.ts
 */
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const BEARER    = process.env.TMDB_BEARER!
const OMDB_KEY  = process.env.OMDB_API_KEY ?? ''
const TMDB_BASE = 'https://api.themoviedb.org/3'
const OMDB_BASE = 'https://www.omdbapi.com'
const IMG_W     = 'https://image.tmdb.org/t/p/w500'
const IMG_O     = 'https://image.tmdb.org/t/p/original'
const IMG_FACE  = 'https://image.tmdb.org/t/p/w185'

const EMBED_SERVERS = (tmdbId: string) => [
  { serverName: 'Server 1', url: `https://player.videasy.net/movie/${tmdbId}`,       type: 'iframe', quality: 'HD', isWorking: true },
  { serverName: 'Server 2', url: `https://www.2embed.cc/embed/${tmdbId}`,             type: 'iframe', quality: 'HD', isWorking: true },
  { serverName: 'Server 3', url: `https://vidsrc.icu/embed/movie/${tmdbId}`,          type: 'iframe', quality: 'HD', isWorking: true },
  { serverName: 'Server 4', url: `https://embed.su/embed/movie/${tmdbId}`,            type: 'iframe', quality: 'HD', isWorking: true },
  { serverName: 'Server 5', url: `https://vidsrc.cc/v2/embed/movie/${tmdbId}`,        type: 'iframe', quality: 'HD', isWorking: true },
  { serverName: 'Server 6', url: `https://vidsrc.to/embed/movie/${tmdbId}`,           type: 'iframe', quality: 'HD', isWorking: true },
  { serverName: 'Server 7', url: `https://autoembed.cc/movie/tmdb/${tmdbId}`,         type: 'iframe', quality: 'HD', isWorking: true },
  { serverName: 'Server 8', url: `https://vidlink.pro/movie/${tmdbId}`,               type: 'iframe', quality: 'HD', isWorking: true },
  { serverName: 'Server 9', url: `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`, type: 'iframe', quality: 'HD', isWorking: true },
]

// Categories to scrape: [url-path, language-tags]
const CATEGORIES: [string, string[]][] = [
  ['movies/bollywood',                      ['Hindi']],
  ['movies/hollywood',                      ['English']],
  ['movies/dual-audio-movies',              ['Hindi', 'English']],
  ['movies/hindi-dubbed-movies-480p-720p',  ['Hindi']],
]

const MAX_PAGES = 8   // pages per category (~18 movies/page = ~144 movies per category)
const EXCLUDED_GENRES = ['Music', 'Talk', 'News', 'Reality', 'Soap']

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function slugify(title: string, year: number) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + year
}

// Parse "Download Pati Patni Aur Woh 2 (2026) Hindi Movie ..." → { title, year }
function parseTitle(raw: string): { title: string; year: number } | null {
  const m = raw.match(/^Download\s+(.+?)\s+\((\d{4})\)/i)
  if (!m) return null
  return { title: m[1].trim(), year: parseInt(m[2]) }
}

// Fetch listing page and return raw post titles
async function scrapePage(category: string, page: number): Promise<string[]> {
  const url = page === 1
    ? `https://new.bollyflix.gd/${category}/`
    : `https://new.bollyflix.gd/${category}/page/${page}/`

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html',
    },
  })
  if (!res.ok) return []
  const html = await res.text()

  // Extract titles from <h2 class="title front-view-title"><a ...>TITLE</a></h2>
  const matches = [...html.matchAll(/class="title front-view-title"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/gi)]
  return matches.map(m => m[1].trim().replace(/&#038;/g, '&').replace(/&amp;/g, '&'))
}

async function tmdbSearch(title: string, year: number): Promise<any | null> {
  try {
    const q = encodeURIComponent(title)
    const res = await fetch(
      `${TMDB_BASE}/search/movie?query=${q}&year=${year}&language=en-US&include_adult=false`,
      { headers: { Authorization: `Bearer ${BEARER}`, Accept: 'application/json' } }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data.results?.length) {
      // retry without year constraint
      const res2 = await fetch(
        `${TMDB_BASE}/search/movie?query=${q}&language=en-US&include_adult=false`,
        { headers: { Authorization: `Bearer ${BEARER}`, Accept: 'application/json' } }
      )
      const data2 = await res2.json()
      return data2.results?.[0] ?? null
    }
    return data.results[0]
  } catch { return null }
}

async function tmdbDetail(id: number): Promise<any | null> {
  try {
    const res = await fetch(
      `${TMDB_BASE}/movie/${id}?language=en-US&append_to_response=credits,videos`,
      { headers: { Authorization: `Bearer ${BEARER}`, Accept: 'application/json' } }
    )
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

async function omdbRating(imdbId: string): Promise<number | null> {
  if (!OMDB_KEY || !imdbId) return null
  try {
    const res = await fetch(`${OMDB_BASE}/?i=${imdbId}&apikey=${OMDB_KEY}`)
    const data = await res.json()
    if (data.imdbRating && data.imdbRating !== 'N/A') {
      return Math.round(parseFloat(data.imdbRating) * 10) / 10
    }
  } catch { /* skip */ }
  return null
}

async function main() {
  if (!BEARER) { console.error('TMDB_BEARER not set'); process.exit(1) }

  await mongoose.connect(process.env.MONGODB_URI!)
  console.log('Connected to MongoDB\n')

  const col = mongoose.connection.collection('movies')
  let totalAdded = 0
  let totalSkipped = 0

  for (const [category, langs] of CATEGORIES) {
    console.log(`\n── Scraping /${category}/ (${langs.join(', ')}) ──`)

    const seen = new Set<string>()

    for (let page = 1; page <= MAX_PAGES; page++) {
      const rawTitles = await scrapePage(category, page)
      if (!rawTitles.length) { console.log(`  Page ${page}: empty, stopping`); break }

      process.stdout.write(`  Page ${page}/${MAX_PAGES}: ${rawTitles.length} titles`)

      for (const raw of rawTitles) {
        const parsed = parseTitle(raw)
        if (!parsed) continue
        const { title, year } = parsed
        const dedupeKey = `${title.toLowerCase()}:${year}`
        if (seen.has(dedupeKey)) continue
        seen.add(dedupeKey)

        // Check if already in DB
        const existingSlug = slugify(title, year)
        const exists = await col.findOne({ slug: existingSlug })
        if (exists) { totalSkipped++; continue }

        await sleep(120)

        const basic = await tmdbSearch(title, year)
        if (!basic) { process.stdout.write(' .'); continue }

        await sleep(120)
        const detail = await tmdbDetail(basic.id)
        if (!detail) continue

        const releaseYear = detail.release_date
          ? parseInt(detail.release_date.split('-')[0])
          : year

        const runtime = detail.runtime || 0
        if (runtime > 0 && runtime < 50) continue  // skip shorts

        const genres = (detail.genres || []).map((g: any) => g.name) as string[]
        if (genres.some(g => EXCLUDED_GENRES.includes(g))) continue

        const imdbRating = await omdbRating(detail.imdb_id)
        const rating = imdbRating ?? (Math.round((detail.vote_average || 0) * 10) / 10)

        const cast = (detail.credits?.cast || [])
          .slice(0, 10)
          .map((c: any) => ({
            name: c.name,
            character: c.character,
            photo: c.profile_path ? `${IMG_FACE}${c.profile_path}` : '',
          }))

        const trailer = (detail.videos?.results || [])
          .find((v: any) => v.type === 'Trailer' && v.site === 'YouTube')?.key ?? ''

        const tmdbId = String(basic.id)
        const slug   = slugify(detail.title || title, releaseYear)

        const doc = {
          tmdbId,
          title: detail.title || title,
          slug,
          type: 'movie',
          language: langs,
          genres,
          releaseYear,
          rating,
          runtime,
          synopsis: detail.overview || '',
          posterUrl:   detail.poster_path   ? `${IMG_W}${detail.poster_path}` : '',
          backdropUrl: detail.backdrop_path ? `${IMG_O}${detail.backdrop_path}` : '',
          trailerKey: trailer,
          cast,
          sources: EMBED_SERVERS(tmdbId),
          streamVerified: true,
          scrapedFrom: 'bollyflix',
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        if (!doc.posterUrl || !doc.backdropUrl) continue  // skip no-image movies

        await col.updateOne(
          { slug },
          { $setOnInsert: doc },
          { upsert: true }
        )
        totalAdded++
        process.stdout.write(` +${title}(${releaseYear})`)
      }

      console.log()
      await sleep(800)  // pause between pages
    }
  }

  console.log(`\n\nDone. Added: ${totalAdded}, Skipped (already exist): ${totalSkipped}`)
  await mongoose.disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
