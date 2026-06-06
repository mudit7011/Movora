import path from 'path'; import dotenv from 'dotenv'; import mongoose from 'mongoose'
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: false })
import { tmdbFetch } from '../src/utils/tmdb'
import { importMovie } from '../src/utils/importer'
import { Movie } from '../src/models/Movie'
async function main(){
  await mongoose.connect(process.env.MONGODB_URI!)
  // Scream collection id 2602
  const movie = await tmdbFetch('/movie/4234?language=en-US') // Scream 3
  console.log('belongs_to_collection:', movie.belongs_to_collection)
  const col = await tmdbFetch(`/collection/${movie.belongs_to_collection.id}?language=en-US`)
  console.log('parts:', col.parts.map((p:any)=>`${p.id}:${p.title}(${p.release_date})`).join('\n  '))
  // Try importing Scream 1996 (4232) and Scream 2 (4233) with bypass
  for (const id of [4232, 4233]) {
    const before = await Movie.exists({ tmdbId: String(id) })
    const r = await importMovie(id, { bypassGate: true })
    console.log(`import ${id}: before=${!!before} result=${JSON.stringify(r)}`)
  }
  await mongoose.disconnect()
}
main().catch(e=>{console.error(e);process.exit(1)})
