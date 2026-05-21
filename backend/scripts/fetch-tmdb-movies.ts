/**
 * Fetches movies from TMDB API and seeds them into MongoDB.
 * Run: npx ts-node scripts/fetch-tmdb-movies.ts
 */
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { tmdbFetch } from '../src/utils/tmdb'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const OMDB_KEY  = process.env.OMDB_API_KEY ?? ''
const OMDB_BASE = 'https://www.omdbapi.com'
const IMG_W     = 'https://image.tmdb.org/t/p/w500'
const IMG_O     = 'https://image.tmdb.org/t/p/original'
const IMG_FACE  = 'https://image.tmdb.org/t/p/w185'

const LANG_LABEL: Record<string, string> = {
  hi: 'Hindi',
  en: 'English',
  ta: 'Tamil',
  te: 'Telugu',
  ml: 'Malayalam',
  bn: 'Bengali',
  mr: 'Marathi',
  pa: 'Punjabi',
}

function slugify(title: string, year: number) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + year
}

async function tmdb(endpoint: string): Promise<any> {
  return tmdbFetch(endpoint)
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

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

async function fetchPage(endpoint: string, page: number): Promise<any[]> {
  const sep = endpoint.includes('?') ? '&' : '?'
  const data = await tmdb(`${endpoint}${sep}page=${page}`)
  return data.results || []
}

async function collectMovies(lang: string, pages: number): Promise<Map<number, any>> {
  const map = new Map<number, any>()
  const endpoints = [
    `/movie/popular?language=en-US&with_original_language=${lang}`,
    `/movie/top_rated?language=en-US&with_original_language=${lang}`,
    `/discover/movie?language=en-US&with_original_language=${lang}&sort_by=revenue.desc`,
    `/discover/movie?language=en-US&with_original_language=${lang}&sort_by=vote_count.desc`,
  ]

  for (const ep of endpoints) {
    for (let p = 1; p <= pages; p++) {
      try {
        const results = await fetchPage(ep, p)
        results.forEach(m => { if (m.id) map.set(m.id, m) })
        process.stdout.write(`\r  ${lang}: ${map.size} unique (${ep.split('?')[0].split('/').pop()} p${p}/${pages})   `)
        await sleep(80)
      } catch (e: any) {
        process.stdout.write(`\n  Retrying p${p}... `)
        await sleep(1000)
        try {
          const results = await fetchPage(ep, p)
          results.forEach(m => { if (m.id) map.set(m.id, m) })
        } catch { /* skip this page */ }
      }
    }
  }
  console.log()
  return map
}

async function enrichAndUpsert(
  movieId: number,
  basicInfo: any,
  lang: string,
  col: mongoose.mongo.Collection,
): Promise<boolean> {
  try {
    const [detail, credits, videos] = await Promise.all([
      tmdb(`/movie/${movieId}?language=en-US`),
      tmdb(`/movie/${movieId}/credits?language=en-US`),
      tmdb(`/movie/${movieId}/videos?language=en-US`),
    ])
    await sleep(120)

    const year = basicInfo.release_date ? parseInt(basicInfo.release_date.split('-')[0]) : 0
    if (!year || !basicInfo.title) return false

    const trailer = (videos.results || []).find(
      (v: any) => v.site === 'YouTube' && v.type === 'Trailer'
    )?.key

    const cast = (credits.cast || []).slice(0, 15).map((c: any) => ({
      name: c.name,
      character: c.character || '',
      ...(c.profile_path ? { photo: `${IMG_FACE}${c.profile_path}` } : {}),
    }))

    const originalLang = detail.original_language || lang
    const langLabel = LANG_LABEL[originalLang] || originalLang.toUpperCase()
    const genres = (detail.genres || []).map((g: any) => g.name)

    // Use real IMDb rating if OMDB key available, else TMDB vote_average from detail endpoint
    const imdb = await omdbRating(detail.imdb_id)
    const rating = imdb ?? (Math.round((detail.vote_average || 0) * 10) / 10)

    const doc = {
      tmdbId: String(movieId),
      title: basicInfo.title,
      slug: slugify(basicInfo.title, year),
      type: 'movie' as const,
      language: [langLabel],
      genres,
      releaseYear: year,
      rating,
      runtime: detail.runtime || 0,
      synopsis: basicInfo.overview || '',
      posterUrl: basicInfo.poster_path ? `${IMG_W}${basicInfo.poster_path}` : '',
      backdropUrl: basicInfo.backdrop_path ? `${IMG_O}${basicInfo.backdrop_path}` : '',
      ...(trailer ? { trailerKey: trailer } : {}),
      cast,
      sources: [
        { serverName: 'Server 1', url: `https://player.videasy.net/movie/${movieId}`,            type: 'iframe' as const, quality: 'HD', isWorking: true },
        { serverName: 'Server 2', url: `https://www.2embed.cc/embed/${movieId}`,                 type: 'iframe' as const, quality: 'HD', isWorking: true },
        { serverName: 'Server 3', url: `https://vidsrc.icu/embed/movie/${movieId}`,              type: 'iframe' as const, quality: 'HD', isWorking: true },
        { serverName: 'Server 4', url: `https://embed.su/embed/movie/${movieId}`,                type: 'iframe' as const, quality: 'HD', isWorking: true },
        { serverName: 'Server 5', url: `https://vidsrc.cc/v2/embed/movie/${movieId}`,            type: 'iframe' as const, quality: 'HD', isWorking: true },
      ],
      scrapedFrom: 'tmdb-fetch',
      updatedAt: new Date(),
    }

    await col.updateOne(
      { tmdbId: doc.tmdbId },
      { $set: doc, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    )
    return true
  } catch {
    return false
  }
}

async function main() {
  if (!process.env.TMDB_BEARER) { console.error('TMDB_BEARER not set in .env'); process.exit(1) }

  await mongoose.connect(process.env.MONGODB_URI!)
  console.log('Connected to MongoDB\n')

  const col = mongoose.connection.collection('movies')
  let grandTotal = 0

  // [language_code, pages_per_endpoint]
  // Each language fetches: popular + top_rated + revenue + vote_count sorted = 4 * pages results
  const targets: [string, number][] = [
    ['hi', 30],  // Hindi: 4 endpoints × 30 pages = ~2400 raw, deduped ~1200
    ['en', 30],  // English: ~1200
  ]

  for (const [lang, pages] of targets) {
    const label = LANG_LABEL[lang] || lang
    console.log(`\n── ${label} ──`)

    const movieMap = await collectMovies(lang, pages)
    const movies = Array.from(movieMap.entries())
    console.log(`  Enriching ${movies.length} movies from TMDB...`)

    let done = 0, saved = 0
    for (const [id, basic] of movies) {
      done++
      const title = (basic.title || '').substring(0, 38).padEnd(38)
      process.stdout.write(`\r  [${done}/${movies.length}] ${title} `)
      const ok = await enrichAndUpsert(id, basic, lang, col)
      if (ok) { saved++; grandTotal++ }
    }
    console.log(`\n  ✓ ${saved}/${movies.length} saved`)
  }

  console.log(`\n✅ Complete! ${grandTotal} movies upserted into MongoDB.`)
  await mongoose.disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
