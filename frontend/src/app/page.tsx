import { api } from '@/lib/api'
import HomePageClient from '@/components/HomePageClient'

export default async function HomePage() {
  const [trending, latest] = await Promise.all([
    api.getTrending().catch(() => []),
    api.getLatest().catch(() => []),
  ])

  const hindi = latest.filter(m => m.language.includes('Hindi'))
  const dubbed = latest.filter(m => m.language.some(l => l.toLowerCase().includes('dubbed')))
  const english = latest.filter(m => m.language.includes('English'))

  return (
    <HomePageClient
      trending={trending}
      latest={latest}
      hindi={hindi}
      dubbed={dubbed}
      english={english}
    />
  )
}
