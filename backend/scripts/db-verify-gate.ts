import path from 'path'; import dotenv from 'dotenv'; import mongoose from 'mongoose'
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: false })
async function main() {
  await mongoose.connect(process.env.MONGODB_URI!)
  const col = mongoose.connection.db!.collection('movies')
  for (const m of [10, 30]) {
    const since = new Date(Date.now() - m*60*1000)
    const total = await col.countDocuments({ createdAt: { $gte: since } })
    const junk = await col.countDocuments({ createdAt: { $gte: since }, $or:[{releaseYear:{$lt:2000}},{posterUrl:{$in:['',null]}},{rating:{$lte:0}}] })
    console.log(`last ${m}min: added=${total}  junk(pre2000/noposter/unrated)=${junk}`)
  }
  const recent = await col.find({}).sort({createdAt:-1}).limit(8).project({title:1,releaseYear:1,rating:1,createdAt:1}).toArray()
  console.log('\nmost recent 8:')
  for (const d of recent) console.log(`- "${d.title}" (${d.releaseYear}) rating=${d.rating} @${d.createdAt?.toISOString?.()}`)
  await mongoose.disconnect()
}
main().catch(e=>{console.error(e);process.exit(1)})
