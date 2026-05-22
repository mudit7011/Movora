import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

mongoose.connect(process.env.MONGODB_URI!).then(async () => {
  const m = await mongoose.connection.db!.collection('movies').findOne({ releaseYear: { $gte: 2025 }, rating: { $gte: 8 } })
  if (m) {
    const skip = new Set(['sources', 'cast', 'synopsis', 'posterUrl', 'backdropUrl', 'trailerKey'])
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(m)) {
      if (!skip.has(k)) out[k] = m[k]
    }
    console.log(JSON.stringify(out, null, 2))
  }
  await mongoose.disconnect()
})
