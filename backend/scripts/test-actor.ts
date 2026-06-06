import path from 'path'; import dotenv from 'dotenv'; import mongoose from 'mongoose'
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: false })
import { tmdbFetch } from '../src/utils/tmdb'
import { Movie } from '../src/models/Movie'
async function lookup(name: string) {
  const s = await tmdbFetch(`/search/person?query=${encodeURIComponent(name)}&language=en-US`)
  const p = (s.results||[])[0]; if(!p){console.log(name,'-> no person');return}
  const c = await tmdbFetch(`/person/${p.id}/combined_credits?language=en-US`)
  const cast = (c.cast||[]).filter((x:any)=>x.media_type==='movie'||x.media_type==='tv').sort((a:any,b:any)=>(b.popularity||0)-(a.popularity||0))
  const ids = cast.map((x:any)=> x.media_type==='tv'?`tv_${x.id}`:String(x.id))
  const docs = await Movie.find({tmdbId:{$in:ids}, posterUrl:{$ne:''}}).select('title type releaseYear').lean()
  console.log(`\n${p.name}: TMDB credits=${cast.length}, in our DB=${docs.length}`)
  docs.slice(0,8).forEach((d:any)=>console.log(`  - ${d.title} (${d.releaseYear}) ${d.type}`))
}
async function main(){await mongoose.connect(process.env.MONGODB_URI!)
  for(const n of ['Shah Rukh Khan','Tom Cruise','Leonardo DiCaprio']) await lookup(n)
  await mongoose.disconnect()}
main().catch(e=>{console.error(e);process.exit(1)})
