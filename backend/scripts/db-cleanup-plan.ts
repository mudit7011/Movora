import path from 'path'
import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: false })

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI missing')
  await mongoose.connect(uri)
  const col = mongoose.connection.db!.collection('movies')

  const total = await col.countDocuments()
  console.log('TOTAL:', total)

  // Categories of bloat the public site NEVER surfaces (it always filters posterUrl, year>=2000, rating, runtime)
  const checks: Record<string, any> = {
    'no poster':                 { $or: [{ posterUrl: '' }, { posterUrl: null }, { posterUrl: { $exists: false } }] },
    'pre-2000 (year<2000)':      { releaseYear: { $lt: 2000 } },
    'no/zero rating':            { $or: [{ rating: { $lte: 0 } }, { rating: { $exists: false } }, { rating: null }] },
    'movie runtime<60':          { type: 'movie', runtime: { $lt: 60 } },
    'no sources':                { $or: [{ sources: { $size: 0 } }, { sources: { $exists: false } }] },
    "scrapedFrom=realtime":      { scrapedFrom: 'realtime' },
  }
  console.log('\n=== individual counts ===')
  for (const [label, q] of Object.entries(checks)) {
    console.log(`${label}: ${await col.countDocuments(q)}`)
  }

  // The COMBINED "never shown" set: anything missing poster OR pre-2000 OR no rating OR (movie & runtime<60)
  const neverShown = {
    $or: [
      { posterUrl: { $in: ['', null] } },
      { posterUrl: { $exists: false } },
      { releaseYear: { $lt: 2000 } },
      { rating: { $lte: 0 } },
      { rating: { $exists: false } },
      { type: 'movie', runtime: { $lt: 60 } },
    ],
  }
  console.log('\n=== COMBINED "never surfaced by site" (safe-delete candidate) ===')
  console.log('count:', await col.countDocuments(neverShown))

  // Language distribution (top 20) to see foreign bloat
  console.log('\n=== language distribution (top 20) ===')
  const langs = await col.aggregate([
    { $unwind: '$language' },
    { $group: { _id: '$language', n: { $sum: 1 } } },
    { $sort: { n: -1 } }, { $limit: 20 },
  ]).toArray()
  console.table(langs)

  // Year distribution buckets
  console.log('\n=== year buckets ===')
  const years = await col.aggregate([
    { $bucket: { groupBy: '$releaseYear', boundaries: [0, 1980, 2000, 2010, 2018, 2022, 2025, 2027, 3000], default: 'other', output: { n: { $sum: 1 } } } },
  ]).toArray()
  console.table(years)

  await mongoose.disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
