/**
 * Corrects language labels in MongoDB by re-checking TMDB's original_language.
 * Run: npx ts-node scripts/fix-languages.ts
 */
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { tmdbFetch } from '../src/utils/tmdb'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const LANG_LABEL: Record<string, string> = {
  hi: 'Hindi', en: 'English', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam',
  bn: 'Bengali', mr: 'Marathi', pa: 'Punjabi', ko: 'Korean', ja: 'Japanese',
  zh: 'Chinese', fr: 'French', es: 'Spanish', de: 'German', it: 'Italian',
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function getOriginalLang(tmdbId: string, title: string): Promise<string | null> {
  try {
    const data = await tmdbFetch(`/movie/${tmdbId}?language=en-US`)
    return data.original_language || null
  } catch (e: any) {
    console.log(`\n  ✗ ERROR for ${title} (${tmdbId}): ${e.message}`)
    return null
  }
}

async function main() {
  if (!process.env.TMDB_BEARER) { console.error('TMDB_BEARER not set'); process.exit(1) }

  await mongoose.connect(process.env.MONGODB_URI!)
  console.log('Connected to MongoDB')

  const col = mongoose.connection.collection('movies')
  const movies = await col
    .find({ tmdbId: { $exists: true }, type: 'movie' }, { projection: { _id: 1, tmdbId: 1, language: 1, title: 1 } })
    .toArray()

  console.log(`Checking ${movies.length} movies...\n`)

  let checked = 0, fixed = 0, errors = 0

  for (const movie of movies) {
    checked++
    process.stdout.write(`\r  [${checked}/${movies.length}] fixed=${fixed} errors=${errors}   `)

    const origLang = await getOriginalLang(movie.tmdbId, movie.title)
    if (!origLang) { errors++; continue }

    const correctLabel = LANG_LABEL[origLang] || origLang.toUpperCase()
    const currentLabel = Array.isArray(movie.language) ? movie.language[0] : movie.language

    if (currentLabel !== correctLabel) {
      await col.updateOne({ _id: movie._id }, { $set: { language: [correctLabel] } })
      process.stdout.write(`\n  Fixed: "${movie.title}"  ${currentLabel} → ${correctLabel}\n`)
      fixed++
    }

    await sleep(80)
  }

  console.log(`\n\n✅ Done! Checked ${checked}, fixed ${fixed}, errors ${errors}`)
  await mongoose.disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
