/**
 * Fixes inflated ratings for 2025-2026 movies using OMDB (real IMDb data).
 * Run: npx ts-node scripts/fix-2026-ratings.ts
 */
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const OMDB_KEY = process.env.OMDB_API_KEY || '1363d531'
const OMDB_BASE = 'https://www.omdbapi.com'

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function getOmdbRating(imdbId: string): Promise<number | null> {
  try {
    const res = await fetch(`${OMDB_BASE}/?i=${imdbId}&apikey=${OMDB_KEY}`)
    if (!res.ok) return null
    const data = await res.json()
    if (data.Response === 'False' || !data.imdbRating || data.imdbRating === 'N/A') return null
    return parseFloat(data.imdbRating)
  } catch { return null }
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!)
  console.log('Connected')

  const db = mongoose.connection.db!
  // Fix: stray language codes
  const stray = await db.collection('movies').deleteMany({ language: { $in: ['TL', 'PT', 'BN', 'MR', 'PA'] } })
  console.log(`Deleted ${stray.deletedCount} stray language-code movies`)

  // Fix: 2025-2026 movies with OMDB
  const movies = await db.collection('movies').find({
    releaseYear: { $gte: 2025 },
    imdbId: { $exists: true, $ne: '' }
  }).toArray()

  console.log(`Fixing ratings for ${movies.length} movies from 2025-2026...`)
  let fixed = 0

  for (const movie of movies) {
    const rating = await getOmdbRating(movie.imdbId)
    if (rating !== null) {
      await db.collection('movies').updateOne(
        { _id: movie._id },
        { $set: { rating } }
      )
      if (movie.rating !== rating) {
        console.log(`  ${movie.title}: ${movie.rating} → ${rating}`)
        fixed++
      }
    }
    await sleep(120)
  }

  console.log(`Updated ${fixed} ratings. Done.`)
  await mongoose.disconnect()
}

run().catch(console.error)
