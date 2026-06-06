import path from 'path'
import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: false })

// Records the public site NEVER surfaces (every query filters poster/year/rating/runtime).
const NEVER_SHOWN = {
  $or: [
    { posterUrl: { $in: ['', null] } },
    { posterUrl: { $exists: false } },
    { releaseYear: { $lt: 2000 } },
    { rating: { $lte: 0 } },
    { rating: { $exists: false } },
    { type: 'movie', runtime: { $lt: 60 } },
  ],
}

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI missing')
  await mongoose.connect(uri)
  const db = mongoose.connection.db!
  const col = db.collection('movies')

  const before = await col.countDocuments()
  const target = await col.countDocuments(NEVER_SHOWN as any)
  console.log(`Total before: ${before}`)
  console.log(`Matching dead records to delete: ${target}`)
  // Safety guard: bail if the filter would somehow nuke everything.
  if (target >= before) { console.error('ABORT: filter matches all/most docs'); process.exit(1) }

  console.log('Deleting...')
  const t0 = Date.now()
  const result = await col.deleteMany(NEVER_SHOWN as any)
  console.log(`Deleted ${result.deletedCount} in ${((Date.now() - t0) / 1000).toFixed(1)}s`)

  const after = await col.countDocuments()
  console.log(`Total after: ${after}  (movies=${await col.countDocuments({ type: 'movie' })}, shows=${await col.countDocuments({ type: 'tvshow' })})`)

  const stats = await db.command({ dbStats: 1, scale: 1024 * 1024 })
  console.log(`Storage now: data=${stats.dataSize?.toFixed(1)}MB store=${stats.storageSize?.toFixed(1)}MB index=${stats.indexSize?.toFixed(1)}MB`)

  await mongoose.disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
