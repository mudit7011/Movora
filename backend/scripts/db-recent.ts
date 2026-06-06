import path from 'path'
import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: false })

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!)
  const col = mongoose.connection.db!.collection('movies')

  console.log('TOTAL:', await col.countDocuments())

  console.log('\n=== by scrapedFrom ===')
  console.table(await col.aggregate([{ $group: { _id: '$scrapedFrom', n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray())

  const since = (h: number) => new Date(Date.now() - h * 3600 * 1000)
  for (const h of [24, 48, 72]) {
    console.log(`\n=== created in last ${h}h: ${await col.countDocuments({ createdAt: { $gte: since(h) } })} ===`)
  }

  console.log('\n=== last 24h by scrapedFrom ===')
  console.table(await col.aggregate([
    { $match: { createdAt: { $gte: since(24) } } },
    { $group: { _id: '$scrapedFrom', n: { $sum: 1 } } }, { $sort: { n: -1 } },
  ]).toArray())

  console.log('\n=== sample of 12 most recent docs ===')
  const recent = await col.find({}).sort({ createdAt: -1 }).limit(12)
    .project({ title: 1, type: 1, tmdbId: 1, scrapedFrom: 1, releaseYear: 1, createdAt: 1 }).toArray()
  for (const d of recent) {
    console.log(`- "${d.title}" (${d.releaseYear}) type=${d.type} from=${d.scrapedFrom} tmdb=${d.tmdbId} @${d.createdAt?.toISOString?.()}`)
  }

  await mongoose.disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
