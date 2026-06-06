import path from 'path'; import dotenv from 'dotenv'; import mongoose from 'mongoose'
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: false })
async function main() {
  await mongoose.connect(process.env.MONGODB_URI!)
  const col = mongoose.connection.db!.collection('movies')
  const since = new Date(Date.now() - 36*3600*1000)
  console.log('remaining realtime docs created in last 36h:', await col.countDocuments({ scrapedFrom:'realtime', createdAt:{$gte:since} }))
  // vote-count buckets among ALL current docs (low votes = borderline obscure but displayable)
  const samp = await col.find({ scrapedFrom:'realtime', createdAt:{$gte:since} }).sort({createdAt:-1}).limit(20)
    .project({title:1,releaseYear:1,rating:1,type:1}).toArray()
  console.log('\nsample of 20 kept (recent realtime):')
  for (const d of samp) console.log(`- "${d.title}" (${d.releaseYear}) ${d.type} rating=${d.rating}`)
  await mongoose.disconnect()
}
main().catch(e=>{console.error(e);process.exit(1)})
