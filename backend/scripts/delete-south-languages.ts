import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const REMOVE_LANGS = ['Telugu', 'Tamil', 'Malayalam', 'Kannada']

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!)
  console.log('Connected to MongoDB')

  const count = await mongoose.connection.db!
    .collection('movies')
    .countDocuments({ language: { $in: REMOVE_LANGS } })

  console.log(`Found ${count} movies with languages: ${REMOVE_LANGS.join(', ')}`)

  if (count === 0) {
    console.log('Nothing to delete.')
    await mongoose.disconnect()
    return
  }

  const result = await mongoose.connection.db!
    .collection('movies')
    .deleteMany({ language: { $in: REMOVE_LANGS } })

  console.log(`Deleted ${result.deletedCount} movies.`)
  await mongoose.disconnect()
  console.log('Done.')
}

run().catch(console.error)
