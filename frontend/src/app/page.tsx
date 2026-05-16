import { api } from '@/lib/api'
import Hero from '@/components/Hero'
import Carousel from '@/components/Carousel'

export default async function HomePage() {
  const [trending, latest] = await Promise.all([
    api.getTrending().catch(() => []),
    api.getLatest().catch(() => []),
  ])

  const hero = trending[0] ?? latest[0]

  const hindi = latest.filter(m => m.language.includes('Hindi'))
  const dubbed = latest.filter(m => m.language.some(l => l.toLowerCase().includes('dubbed')))
  const english = latest.filter(m => m.language.includes('English'))

  return (
    <>
      {hero && <Hero movie={hero} />}

      <div className="max-w-7xl mx-auto">
        <Carousel title="Trending Now" movies={trending} />
        <Carousel title="Latest Releases" movies={latest} />
        {hindi.length > 0 && <Carousel title="Hindi Movies" movies={hindi} />}
        {dubbed.length > 0 && <Carousel title="Hindi Dubbed" movies={dubbed} />}
        {english.length > 0 && <Carousel title="English Movies" movies={english} />}
      </div>
    </>
  )
}
