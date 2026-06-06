import 'dotenv/config'
import mongoose from 'mongoose'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: false })

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI missing')
  await mongoose.connect(uri)
  const db = mongoose.connection.db!

  // DB-level storage stats
  const stats = await db.command({ dbStats: 1, scale: 1024 * 1024 })
  console.log('\n=== STORAGE (MB) ===')
  console.log('dataSize:', stats.dataSize?.toFixed(1), 'storageSize:', stats.storageSize?.toFixed(1), 'indexSize:', stats.indexSize?.toFixed(1), 'total:', ((stats.storageSize || 0) + (stats.indexSize || 0)).toFixed(1))

  console.log('\n=== COLLECTIONS ===')
  const cols = await db.listCollections().toArray()
  for (const c of cols) {
    const cs = await db.command({ collStats: c.name, scale: 1024 * 1024 }).catch(() => null)
    const count = await db.collection(c.name).countDocuments()
    console.log(`${c.name}: docs=${count} storage=${cs?.storageSize?.toFixed(1)}MB index=${cs?.totalIndexSize?.toFixed(1)}MB`)
  }

  const col = db.collection('movies')
  console.log('\n=== movies breakdown ===')
  console.log('total:', await col.countDocuments())
  console.log("type='movie':", await col.countDocuments({ type: 'movie' }))
  console.log("type='tvshow':", await col.countDocuments({ type: 'tvshow' }))
  console.log('type missing/other:', await col.countDocuments({ type: { $nin: ['movie', 'tvshow'] } }))

  console.log('\n=== type value distribution ===')
  const byType = await col.aggregate([{ $group: { _id: '$type', n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray()
  console.table(byType)

  console.log('\n=== scrapedFrom distribution (top 15) ===')
  const bySrc = await col.aggregate([{ $group: { _id: '$scrapedFrom', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 15 }]).toArray()
  console.table(bySrc)

  console.log('\n=== docs with no sources (likely junk) ===')
  console.log('sources empty/missing:', await col.countDocuments({ $or: [{ sources: { $size: 0 } }, { sources: { $exists: false } }] }))

  console.log('\n=== sample of 5 docs ===')
  const sample = await col.find({}).limit(5).project({ title: 1, type: 1, tmdbId: 1, scrapedFrom: 1, releaseYear: 1, posterUrl: 1, 'sources': 1 }).toArray()
  for (const d of sample) {
    console.log(`- "${d.title}" type=${d.type} tmdb=${d.tmdbId} from=${d.scrapedFrom} year=${d.releaseYear} sources=${d.sources?.length ?? 0} poster=${d.posterUrl ? 'y' : 'n'}`)
  }

  await mongoose.disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
