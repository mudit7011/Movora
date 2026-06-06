import path from 'path'; import dotenv from 'dotenv'
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: false })
import { tmdbFetch } from '../src/utils/tmdb'
async function n(vc: number) {
  const d = await tmdbFetch(`/discover/tv?with_original_language=hi&sort_by=popularity.desc&without_genres=10766,10763,10767&vote_average.gte=5&vote_count.gte=${vc}&language=en-US`)
  console.log(`vote_count>=${vc}: total_results=${d.total_results}, pages=${d.total_pages}`)
}
async function main(){ for(const v of [50,20,10,5,1]) await n(v) }
main().catch(e=>{console.error(e);process.exit(1)})
